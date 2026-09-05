// سيرفر يشجب — مع قاعدة البيانات

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const bcrypt  = require('bcryptjs');
const db      = require('./database');

const app  = express();
const PORT = process.env.PORT || 3000;

// إعدادات السيرفر
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use('/images', express.static(path.join(__dirname, 'images')));

// ========== رفع مستندات المزودين ==========

const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadsDir),
        filename: (req, file, cb) => {
            const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, unique + path.extname(file.originalname));
        },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /^image\/|^application\/pdf$/.test(file.mimetype);
        cb(allowed ? null : new Error('نوع ملف غير مسموح'), allowed);
    },
});

// التحقق من صلاحية كوبون خصم وحساب قيمة الخصم (بدون احتساب استخدام)
function checkCoupon(code, amount) {
    if (!code) return { valid: false, message: 'كود الخصم مطلوب' };

    const coupon = db.prepare('SELECT * FROM coupons WHERE code = ?').get(code.trim().toUpperCase());

    if (!coupon || !coupon.is_active) {
        return { valid: false, message: 'كود الخصم غير صحيح' };
    }

    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        return { valid: false, message: 'انتهت صلاحية كود الخصم' };
    }

    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
        return { valid: false, message: 'تم استنفاد عدد مرات استخدام هذا الكود' };
    }

    let discount = coupon.discount_type === 'percent'
        ? Math.round(amount * (coupon.discount_value / 100))
        : Math.round(coupon.discount_value);

    if (coupon.max_discount && discount > coupon.max_discount) discount = Math.round(coupon.max_discount);
    if (discount > amount) discount = amount;
    if (discount < 0) discount = 0;

    return { valid: true, coupon, discount };
}

// إنشاء إشعار لمستخدم واحد (تستخدمها الإشعارات التلقائية بالنظام)
function createNotification(title, message, type, target, receiverPhone, targetPhone = null) {
    db.prepare(`
        INSERT INTO notifications (title, message, type, target, target_phone, receiver_phone)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(title, message, type, target, targetPhone, receiverPhone);
}

// إعادة حساب متوسط تقييم مزوّد من التقييمات الظاهرة فقط (يبقى 5.0 الافتراضي لو ماكو تقييمات بعد)
function recalculateProviderRating(phone) {
    const result = db.prepare(`
        SELECT AVG(rating) AS avg, COUNT(*) AS n FROM reviews
        WHERE reviewed_phone = ? AND reviewed_type = 'provider' AND is_visible = 1
    `).get(phone);

    if (result.n > 0) {
        const rounded = Math.round(result.avg * 10) / 10;
        db.prepare('UPDATE providers SET rating = ? WHERE phone = ?').run(rounded, phone);
    }
}

// ========== API المستخدمين ==========

app.post('/api/auth/send-otp', (req, res) => {
    const { phone } = req.body;

    if (!phone || phone.length !== 9) {
        return res.json({ success: false, message: 'رقم الجوال غير صحيح' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const existing = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);

    if (existing) {
        db.prepare('UPDATE users SET otp = ? WHERE phone = ?').run(otp, phone);
    } else {
        db.prepare('INSERT INTO users (phone, otp) VALUES (?, ?)').run(phone, otp);
    }

    console.log(`📱 OTP للرقم ${phone}: ${otp}`);

    res.json({ success: true, message: 'تم إرسال الرمز', otp });
});

app.post('/api/auth/verify-otp', (req, res) => {
    const { phone, otp } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);

    if (!user || user.otp !== otp) {
        return res.json({ success: false, message: 'رمز التحقق غير صحيح' });
    }

    if (user.suspended_until && new Date(user.suspended_until.replace(' ', 'T') + 'Z') > new Date()) {
        return res.json({ success: false, message: `حسابك موقوف مؤقتاً حتى ${user.suspended_until}` });
    }

    const provider = db.prepare('SELECT suspended_until FROM providers WHERE phone = ?').get(phone);
    if (provider && provider.suspended_until && new Date(provider.suspended_until.replace(' ', 'T') + 'Z') > new Date()) {
        return res.json({ success: false, message: `حساب المزوّد موقوف مؤقتاً حتى ${provider.suspended_until}` });
    }

    db.prepare('UPDATE users SET verified = 1 WHERE phone = ?').run(phone);

    res.json({ success: true, message: 'تم تسجيل الدخول بنجاح', phone, name: user.name });
});

app.put('/api/users/:phone/name', (req, res) => {
    const { name }  = req.body;
    const { phone } = req.params;

    if (!name || !name.trim()) {
        return res.json({ success: false, message: 'الاسم مطلوب' });
    }

    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);

    if (!user) {
        return res.json({ success: false, message: 'المستخدم غير موجود' });
    }

    db.prepare('UPDATE users SET name = ? WHERE phone = ?').run(name.trim(), phone);

    res.json({ success: true, name: name.trim() });
});

// ========== API الطلبات ==========

app.post('/api/orders', (req, res) => {
    const { phone, service, address, productId, lat, lng, couponCode } = req.body;
    let   { providerId, providerName, price } = req.body;

    if (!phone || !service || !address) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
    }

    // تطبيق كوبون الخصم (اختياري)
    let discount   = 0;
    let usedCoupon = null;
    if (couponCode) {
        const check = checkCoupon(couponCode, price);
        if (!check.valid) {
            return res.json({ success: false, message: check.message || 'كود الخصم غير صحيح' });
        }
        discount   = check.discount;
        usedCoupon = check.coupon;
        price      = Math.max(0, price - discount);
    }

    // لو ما انبعث مزود محدد (وايت ماء/سطحة) — مطابقة تلقائية لأفضل مزود متاح لنفس الخدمة
    if (!providerId) {
        const match = db.prepare(`
            SELECT * FROM providers WHERE service_type = ? AND is_available = 1
            ORDER BY rating DESC LIMIT 1
        `).get(service);

        if (match) {
            providerId   = match.id;
            providerName = match.name;
        }
    }

    // جلب هاتف وتقييم المزود (المُختار صراحة أو المُطابَق تلقائياً)
    let providerPhone  = null;
    let providerRating = null;
    if (providerId) {
        const provider = db.prepare('SELECT phone, rating FROM providers WHERE id = ?').get(providerId);
        if (provider) {
            providerPhone  = provider.phone;
            providerRating = provider.rating;
        }
    }

    const commission = Math.round(price * 0.05);

    const result = db.prepare(`
        INSERT INTO orders (phone, service, address, price, commission, provider_id, provider_name, provider_phone, product_id, lat, lng, coupon_code, discount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(phone, service, address, price, commission, providerId || null, providerName || null, providerPhone, productId || null, lat || null, lng || null, usedCoupon ? usedCoupon.code : null, discount);

    if (usedCoupon) {
        db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').run(usedCoupon.id);
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
    order.provider_rating = providerRating;

    // إشعار تلقائي للمزوّد المُسند إليه الطلب (صراحة أو بالمطابقة التلقائية)
    if (providerPhone) {
        createNotification(
            'طلب جديد بانتظارك',
            `لديك طلب ${service} جديد — ${address}`,
            'update', 'specific', providerPhone, providerPhone,
        );
    }

    console.log(`✅ طلب جديد #${order.id} — ${service} — ${address}`);

    res.json({ success: true, order });
});

app.get('/api/orders', (req, res) => {
    const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    res.json({ success: true, orders });
});

app.get('/api/orders/:id', (req, res) => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);

    if (!order) {
        return res.json({ success: false, message: 'الطلب غير موجود' });
    }

    res.json({ success: true, order });
});

app.put('/api/orders/:id/status', (req, res) => {
    const { status } = req.body;

    const current = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);

    if (status === 'accepted' && current && !current.accepted_at) {
        db.prepare("UPDATE orders SET status = ?, accepted_at = datetime('now') WHERE id = ?").run(status, req.params.id);
    } else {
        db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);

    // إشعار تلقائي للعميل عند قبول الطلب أو اكتماله
    if (current && current.status !== status) {
        if (status === 'accepted') {
            createNotification(
                'تم قبول طلبك',
                `${order.provider_name || 'مزوّد'} قبل طلب ${order.service} الخاص بك`,
                'update', 'specific', order.phone, order.phone,
            );
        } else if (status === 'completed') {
            createNotification(
                'اكتمل طلبك',
                `تم اكتمال طلب ${order.service} بنجاح — نتمنى لك تجربة ممتازة`,
                'update', 'specific', order.phone, order.phone,
            );
        }
    }

    res.json({ success: true, order });
});

// تعيين/تغيير مزود الطلب يدوياً (مركز العمليات المباشر)
app.put('/api/orders/:id/assign-provider', (req, res) => {
    const { providerId } = req.body;

    if (!providerId) {
        return res.json({ success: false, message: 'المزود مطلوب' });
    }

    const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(providerId);

    if (!provider) {
        return res.json({ success: false, message: 'المزود غير موجود' });
    }

    db.prepare(`
        UPDATE orders SET provider_id = ?, provider_name = ?, provider_phone = ? WHERE id = ?
    `).run(provider.id, provider.name, provider.phone, req.params.id);

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);

    res.json({ success: true, order });
});

app.get('/api/users', (req, res) => {
    const users = db.prepare('SELECT id, phone, name, verified, created_at FROM users').all();
    res.json({ success: true, users });
});

// ========== API تسجيل المزودين ==========

app.post('/api/providers/register', upload.fields([
    { name: 'idDocument', maxCount: 1 },
    { name: 'certificateDocument', maxCount: 1 },
]), (req, res) => {
    const { fullName, phone, idNumber, iban, serviceType, level } = req.body;
    const levelNum = parseInt(level, 10);

    if (!fullName || !phone || !idNumber || !iban || !serviceType) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
    }

    const idDocFile = req.files?.idDocument?.[0];
    const certDocFile = req.files?.certificateDocument?.[0];

    if (!idDocFile) {
        return res.json({ success: false, message: 'يرجى إرفاق صورة الهوية أو الإقامة' });
    }

    if (levelNum >= 2 && !certDocFile) {
        return res.json({ success: false, message: 'يرجى إرفاق شهادة العمل الحر أو السجل التجاري' });
    }

    const providerLevel = levelNum === 2 ? 'verified' : 'business';

    // تحقق إذا الرقم موجود مسبقاً
    const existing = db.prepare('SELECT * FROM providers WHERE phone = ?').get(phone);

    if (existing) {
        return res.json({ success: false, message: 'رقم الجوال مسجل مسبقاً' });
    }

    const result = db.prepare(`
        INSERT INTO providers (phone, name, service_type, level, id_document_path, certificate_path)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        phone, fullName, serviceType, providerLevel,
        `/uploads/${idDocFile.filename}`,
        certDocFile ? `/uploads/${certDocFile.filename}` : null,
    );

    createNotification(
        'مزوّد جديد انضم',
        `${fullName} سجّل كمزود ${serviceType} (${providerLevel === 'verified' ? 'موثّق' : 'شركة'}) — يحتاج مراجعة`,
        'update', 'specific', 'admin', 'admin',
    );

    console.log(`✅ مزود جديد #${result.lastInsertRowid} — ${fullName} — ${serviceType}`);

    res.json({ success: true, id: result.lastInsertRowid });
});

app.get('/api/providers', (req, res) => {
    const providers = db.prepare(`
        SELECT providers.*,
            (SELECT lat FROM products WHERE products.provider_id = providers.id AND lat IS NOT NULL ORDER BY created_at DESC LIMIT 1) AS lat,
            (SELECT lng FROM products WHERE products.provider_id = providers.id AND lat IS NOT NULL ORDER BY created_at DESC LIMIT 1) AS lng
        FROM providers ORDER BY created_at DESC
    `).all();
    res.json({ success: true, providers });
});
// جلب طلبات مستخدم محدد
app.get('/api/orders/user/:phone', (req, res) => {
    const orders = db.prepare(`
        SELECT orders.*,
            EXISTS(SELECT 1 FROM reviews WHERE reviews.order_id = orders.id AND reviews.reviewer_phone = orders.phone) AS is_reviewed
        FROM orders WHERE phone = ? ORDER BY created_at DESC
    `).all(req.params.phone);

    res.json({ success: true, orders });
});
// ========== API منتجات مزود الحاوية ==========

app.post('/api/products', (req, res) => {
    const { providerId, name, description, size, price, city, neighborhood, minDays, lat, lng } = req.body;

    if (!providerId || !name || !size || !price || !city || !neighborhood || !minDays) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
    }

    const result = db.prepare(`
        INSERT INTO products (provider_id, name, description, size, price, city, neighborhood, min_days, lat, lng)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(providerId, name, description || '', size, price, city, neighborhood, minDays, lat || null, lng || null);

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);

    res.json({ success: true, product });
});

app.get('/api/products/available', (req, res) => {
    const { city } = req.query;

    if (!city) {
        return res.json({ success: false, message: 'المدينة مطلوبة' });
    }

    const products = db.prepare(`
        SELECT products.*,
               providers.name   AS provider_name,
               providers.rating AS provider_rating,
               providers.level  AS provider_level,
               (SELECT COUNT(*) FROM reviews WHERE reviews.reviewed_phone = providers.phone AND reviews.reviewed_type = 'provider' AND reviews.is_visible = 1) AS provider_review_count
        FROM products
        JOIN providers ON providers.id = products.provider_id
        WHERE products.city = ? AND products.is_available = 1 AND providers.is_available = 1
        ORDER BY providers.rating DESC
    `).all(city);

    res.json({ success: true, products });
});

app.get('/api/products/provider/:providerId', (req, res) => {
    const products = db.prepare(
        'SELECT * FROM products WHERE provider_id = ? ORDER BY created_at DESC'
    ).all(req.params.providerId);

    res.json({ success: true, products });
});

app.put('/api/products/:id', (req, res) => {
    const { name, description, size, price, city, neighborhood, isAvailable, minDays, lat, lng } = req.body;

    if (!name || !size || !price || !city || !neighborhood || !minDays) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
    }

    db.prepare(`
        UPDATE products
        SET name = ?, description = ?, size = ?, price = ?, city = ?, neighborhood = ?, is_available = ?, min_days = ?, lat = ?, lng = ?
        WHERE id = ?
    `).run(name, description || '', size, price, city, neighborhood, isAvailable ? 1 : 0, minDays, lat || null, lng || null, req.params.id);

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);

    res.json({ success: true, product });
});

app.delete('/api/products/:id', (req, res) => {
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// ========== API موظفي لوحة الإدارة ==========

app.post('/api/employees', (req, res) => {
    const { name, phone, iban, role, username, password } = req.body;

    if (!name || !phone || !role || !username || !password) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
    }

    const existing = db.prepare('SELECT * FROM employees WHERE username = ?').get(username);

    if (existing) {
        return res.json({ success: false, message: 'اسم المستخدم مستخدم مسبقاً' });
    }

    const hashed = bcrypt.hashSync(password, 10);

    const result = db.prepare(`
        INSERT INTO employees (name, phone, iban, role, username, password)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, phone, iban || '', role, username, hashed);

    const employee = db.prepare(
        'SELECT id, name, phone, iban, role, username, is_active, created_at FROM employees WHERE id = ?'
    ).get(result.lastInsertRowid);

    res.json({ success: true, employee });
});

app.get('/api/employees', (req, res) => {
    const employees = db.prepare(
        'SELECT id, name, phone, iban, role, username, is_active, created_at FROM employees ORDER BY created_at DESC'
    ).all();

    res.json({ success: true, employees });
});

app.put('/api/employees/:id', (req, res) => {
    const { name, phone, iban, role, username, password, isActive } = req.body;

    if (!name || !phone || !role || !username) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
    }

    const existing = db.prepare(
        'SELECT * FROM employees WHERE username = ? AND id != ?'
    ).get(username, req.params.id);

    if (existing) {
        return res.json({ success: false, message: 'اسم المستخدم مستخدم مسبقاً' });
    }

    if (password) {
        const hashed = bcrypt.hashSync(password, 10);
        db.prepare(`
            UPDATE employees SET name = ?, phone = ?, iban = ?, role = ?, username = ?, password = ?, is_active = ?
            WHERE id = ?
        `).run(name, phone, iban || '', role, username, hashed, isActive ? 1 : 0, req.params.id);
    } else {
        db.prepare(`
            UPDATE employees SET name = ?, phone = ?, iban = ?, role = ?, username = ?, is_active = ?
            WHERE id = ?
        `).run(name, phone, iban || '', role, username, isActive ? 1 : 0, req.params.id);
    }

    const employee = db.prepare(
        'SELECT id, name, phone, iban, role, username, is_active, created_at FROM employees WHERE id = ?'
    ).get(req.params.id);

    res.json({ success: true, employee });
});

app.delete('/api/employees/:id', (req, res) => {
    db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

app.post('/api/employees/login', (req, res) => {
    const { username, password } = req.body;

    const employee = db.prepare('SELECT * FROM employees WHERE username = ?').get(username);

    if (!employee || !employee.is_active || !bcrypt.compareSync(password, employee.password)) {
        return res.json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }

    res.json({
        success: true,
        employee: { id: employee.id, name: employee.name, role: employee.role, username: employee.username },
    });
});

// ========== API المدن ==========

app.get('/api/cities', (req, res) => {
    const cities = db.prepare('SELECT * FROM cities ORDER BY name').all();
    res.json({ success: true, cities });
});

app.get('/api/cities/active', (req, res) => {
    const cities = db.prepare('SELECT * FROM cities WHERE is_active = 1 ORDER BY name').all();
    res.json({ success: true, cities });
});

app.post('/api/cities', (req, res) => {
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.json({ success: false, message: 'اسم المدينة مطلوب' });
    }

    const existing = db.prepare('SELECT * FROM cities WHERE name = ?').get(name.trim());
    if (existing) {
        return res.json({ success: false, message: 'المدينة مضافة مسبقاً' });
    }

    const result = db.prepare('INSERT INTO cities (name) VALUES (?)').run(name.trim());
    const city = db.prepare('SELECT * FROM cities WHERE id = ?').get(result.lastInsertRowid);

    res.json({ success: true, city });
});

app.put('/api/cities/:id', (req, res) => {
    const { name, isActive } = req.body;

    if (!name || !name.trim()) {
        return res.json({ success: false, message: 'اسم المدينة مطلوب' });
    }

    const existing = db.prepare('SELECT * FROM cities WHERE name = ? AND id != ?').get(name.trim(), req.params.id);
    if (existing) {
        return res.json({ success: false, message: 'المدينة مضافة مسبقاً' });
    }

    db.prepare('UPDATE cities SET name = ?, is_active = ? WHERE id = ?')
        .run(name.trim(), isActive ? 1 : 0, req.params.id);

    const city = db.prepare('SELECT * FROM cities WHERE id = ?').get(req.params.id);
    res.json({ success: true, city });
});

app.delete('/api/cities/:id', (req, res) => {
    db.prepare('DELETE FROM cities WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// ========== API كتالوج الخدمات ==========

app.get('/api/services', (req, res) => {
    const services = db.prepare('SELECT * FROM services ORDER BY sort_order, id').all();
    res.json({ success: true, services });
});

app.get('/api/services/active', (req, res) => {
    const services = db.prepare('SELECT * FROM services WHERE is_active = 1 ORDER BY sort_order, id').all();
    res.json({ success: true, services });
});

app.post('/api/services', (req, res) => {
    const { name, icon, description, badgeType, actionType, minPrice, timeEstimate, sortOrder } = req.body;

    if (!name || !name.trim() || !icon || !icon.trim()) {
        return res.json({ success: false, message: 'اسم الخدمة والأيقونة مطلوبان' });
    }

    const existing = db.prepare('SELECT * FROM services WHERE name = ?').get(name.trim());
    if (existing) {
        return res.json({ success: false, message: 'اسم الخدمة مستخدم مسبقاً' });
    }

    const result = db.prepare(`
        INSERT INTO services (name, icon, description, badge_type, action_type, min_price, time_estimate, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        name.trim(), icon.trim(), description || '',
        badgeType || 'instant', actionType || 'order',
        minPrice || null, timeEstimate || null, sortOrder || 0,
    );

    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, service });
});

app.put('/api/services/:id', (req, res) => {
    const { name, icon, description, badgeType, actionType, minPrice, timeEstimate, sortOrder, isActive } = req.body;

    if (!name || !name.trim() || !icon || !icon.trim()) {
        return res.json({ success: false, message: 'اسم الخدمة والأيقونة مطلوبان' });
    }

    const existing = db.prepare('SELECT * FROM services WHERE name = ? AND id != ?').get(name.trim(), req.params.id);
    if (existing) {
        return res.json({ success: false, message: 'اسم الخدمة مستخدم مسبقاً' });
    }

    db.prepare(`
        UPDATE services
        SET name = ?, icon = ?, description = ?, badge_type = ?, action_type = ?, min_price = ?, time_estimate = ?, sort_order = ?, is_active = ?
        WHERE id = ?
    `).run(
        name.trim(), icon.trim(), description || '',
        badgeType || 'instant', actionType || 'order',
        minPrice || null, timeEstimate || null, sortOrder || 0, isActive ? 1 : 0,
        req.params.id,
    );

    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
    res.json({ success: true, service });
});

app.delete('/api/services/:id', (req, res) => {
    db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// ========== API كوبونات الخصم ==========

app.get('/api/coupons', (req, res) => {
    const coupons = db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all();
    res.json({ success: true, coupons });
});

app.post('/api/coupons', (req, res) => {
    const { code, discountType, discountValue, maxDiscount, usageLimit, expiresAt } = req.body;

    if (!code || !code.trim() || !discountValue) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
    }

    const normalizedCode = code.trim().toUpperCase();
    const existing = db.prepare('SELECT * FROM coupons WHERE code = ?').get(normalizedCode);
    if (existing) {
        return res.json({ success: false, message: 'كود الخصم مستخدم مسبقاً' });
    }

    const result = db.prepare(`
        INSERT INTO coupons (code, discount_type, discount_value, max_discount, usage_limit, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        normalizedCode,
        discountType === 'fixed' ? 'fixed' : 'percent',
        discountValue,
        maxDiscount || null,
        usageLimit || null,
        expiresAt || null,
    );

    const coupon = db.prepare('SELECT * FROM coupons WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, coupon });
});

app.put('/api/coupons/:id', (req, res) => {
    const { code, discountType, discountValue, maxDiscount, usageLimit, expiresAt, isActive } = req.body;

    if (!code || !code.trim() || !discountValue) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
    }

    const normalizedCode = code.trim().toUpperCase();
    const existing = db.prepare('SELECT * FROM coupons WHERE code = ? AND id != ?').get(normalizedCode, req.params.id);
    if (existing) {
        return res.json({ success: false, message: 'كود الخصم مستخدم مسبقاً' });
    }

    db.prepare(`
        UPDATE coupons
        SET code = ?, discount_type = ?, discount_value = ?, max_discount = ?, usage_limit = ?, expires_at = ?, is_active = ?
        WHERE id = ?
    `).run(
        normalizedCode,
        discountType === 'fixed' ? 'fixed' : 'percent',
        discountValue,
        maxDiscount || null,
        usageLimit || null,
        expiresAt || null,
        isActive ? 1 : 0,
        req.params.id,
    );

    const coupon = db.prepare('SELECT * FROM coupons WHERE id = ?').get(req.params.id);
    res.json({ success: true, coupon });
});

app.delete('/api/coupons/:id', (req, res) => {
    db.prepare('DELETE FROM coupons WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

app.post('/api/coupons/validate', (req, res) => {
    const { code, amount } = req.body;
    const check = checkCoupon(code, Number(amount) || 0);

    if (!check.valid) {
        return res.json({ success: false, message: check.message });
    }

    res.json({
        success: true,
        discount: check.discount,
        discountType: check.coupon.discount_type,
        discountValue: check.coupon.discount_value,
        maxDiscount: check.coupon.max_discount,
    });
});

// ========== API المحادثات ==========

app.get('/api/chats', (req, res) => {
    const rows = db.prepare(`
        SELECT chats.order_id,
               orders.service, orders.phone AS client_phone, orders.provider_name, orders.provider_phone,
               orders.status AS order_status,
               users.name AS client_name,
               COUNT(*) AS message_count,
               SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread_count,
               MAX(chats.created_at) AS last_message_at,
               (SELECT message FROM chats c2 WHERE c2.order_id = chats.order_id ORDER BY c2.created_at DESC, c2.id DESC LIMIT 1) AS last_message,
               (SELECT sender  FROM chats c2 WHERE c2.order_id = chats.order_id ORDER BY c2.created_at DESC, c2.id DESC LIMIT 1) AS last_sender
        FROM chats
        JOIN orders ON orders.id = chats.order_id
        LEFT JOIN users ON users.phone = orders.phone
        GROUP BY chats.order_id
        ORDER BY MAX(chats.id) DESC
    `).all();

    const now = Date.now();
    const conversations = rows.map(r => {
        const lastMs = new Date(r.last_message_at.replace(' ', 'T') + 'Z').getTime();
        const staleMinutes = (now - lastMs) / 60000;
        const isActive = r.order_status === 'pending' || r.order_status === 'accepted';
        return { ...r, needs_intervention: isActive && staleMinutes > 30 ? 1 : 0 };
    });

    res.json({ success: true, conversations });
});

app.get('/api/chats/:orderId', (req, res) => {
    const messages = db.prepare(
        'SELECT * FROM chats WHERE order_id = ? ORDER BY created_at ASC, id ASC'
    ).all(req.params.orderId);

    res.json({ success: true, messages });
});

app.post('/api/chats', (req, res) => {
    const { orderId, sender, senderPhone, message } = req.body;

    if (!orderId || !sender || !message || !message.trim()) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
    }

    const result = db.prepare(`
        INSERT INTO chats (order_id, sender, sender_phone, message) VALUES (?, ?, ?, ?)
    `).run(orderId, sender, senderPhone || null, message.trim());

    const chatMessage = db.prepare('SELECT * FROM chats WHERE id = ?').get(result.lastInsertRowid);

    res.json({ success: true, chatMessage });
});

app.put('/api/chats/:orderId/read', (req, res) => {
    db.prepare('UPDATE chats SET is_read = 1 WHERE order_id = ?').run(req.params.orderId);
    res.json({ success: true });
});

// ========== API الإشعارات ==========

app.post('/api/notifications/send', (req, res) => {
    const { title, message, type, target, targetPhone } = req.body;

    if (!title || !title.trim() || !message || !message.trim() || !target) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
    }

    let receivers = [];

    if (target === 'specific') {
        if (!targetPhone || !targetPhone.trim()) {
            return res.json({ success: false, message: 'رقم جوال المستلم مطلوب' });
        }
        receivers = [targetPhone.trim()];
    } else if (target === 'clients') {
        receivers = db.prepare('SELECT DISTINCT phone FROM users').all().map(r => r.phone);
    } else if (target === 'providers') {
        receivers = db.prepare('SELECT DISTINCT phone FROM providers').all().map(r => r.phone);
    } else if (target === 'all') {
        const clientPhones   = db.prepare('SELECT DISTINCT phone FROM users').all().map(r => r.phone);
        const providerPhones = db.prepare('SELECT DISTINCT phone FROM providers').all().map(r => r.phone);
        receivers = [...new Set([...clientPhones, ...providerPhones])];
    } else {
        return res.json({ success: false, message: 'وجهة إرسال غير صحيحة' });
    }

    if (!receivers.length) {
        return res.json({ success: false, message: 'ما فيه أي مستلمين مطابقين لهذي الوجهة' });
    }

    const insert = db.prepare(`
        INSERT INTO notifications (title, message, type, target, target_phone, receiver_phone)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((phones) => {
        phones.forEach(phone => {
            insert.run(title.trim(), message.trim(), type || 'update', target, target === 'specific' ? targetPhone.trim() : null, phone);
        });
    });
    insertMany(receivers);

    res.json({ success: true, count: receivers.length });
});

app.get('/api/notifications/:phone', (req, res) => {
    const notifications = db.prepare(
        'SELECT * FROM notifications WHERE receiver_phone = ? ORDER BY created_at DESC, id DESC'
    ).all(req.params.phone);

    res.json({ success: true, notifications });
});

app.put('/api/notifications/:id/read', (req, res) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

app.put('/api/notifications/read-all/:phone', (req, res) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE receiver_phone = ?').run(req.params.phone);
    res.json({ success: true });
});

app.delete('/api/notifications/:id', (req, res) => {
    db.prepare('DELETE FROM notifications WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

app.get('/api/notifications/admin/all', (req, res) => {
    const notifications = db.prepare(
        'SELECT * FROM notifications ORDER BY created_at DESC, id DESC'
    ).all();

    res.json({ success: true, notifications });
});

// ========== API البلاغات والشكاوى ==========

const COMPLAINT_JOIN_SQL = `
    SELECT complaints.*, orders.service AS order_service, orders.address AS order_address, orders.price AS order_price,
        COALESCE(
            (SELECT name FROM users WHERE phone = complaints.reporter_phone),
            (SELECT name FROM providers WHERE phone = complaints.reporter_phone)
        ) AS reporter_name,
        COALESCE(
            (SELECT name FROM users WHERE phone = complaints.reported_phone),
            (SELECT name FROM providers WHERE phone = complaints.reported_phone)
        ) AS reported_name
    FROM complaints
    LEFT JOIN orders ON orders.id = complaints.order_id
`;

app.post('/api/complaints', (req, res) => {
    const { orderId, reporterPhone, reporterType, reportedPhone, reportedType, type, description } = req.body;

    if (!reporterPhone || !reporterType || !type) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
    }

    const result = db.prepare(`
        INSERT INTO complaints (order_id, reporter_phone, reporter_type, reported_phone, reported_type, type, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(orderId || null, reporterPhone, reporterType, reportedPhone || null, reportedType || null, type, description || '');

    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(result.lastInsertRowid);

    createNotification(
        'شكوى جديدة',
        `بلاغ جديد (${type}) من ${reporterType === 'client' ? 'عميل' : 'مزوّد'} — رقم البلاغ #${complaint.id}`,
        'urgent', 'specific', 'admin', 'admin',
    );

    // تنبيه عاجل لو تجمّعت 3 شكاوى ضد نفس الشخص (يُطلق مرة وحدة فقط عند الوصول بالضبط لـ 3)
    if (reportedPhone) {
        const count = db.prepare('SELECT COUNT(*) AS n FROM complaints WHERE reported_phone = ?').get(reportedPhone).n;
        if (count === 3) {
            createNotification(
                'تكرار شكاوى',
                `تم استلام 3 شكاوى ضد ${reportedType === 'provider' ? 'المزوّد' : 'المستخدم'} صاحب الرقم ${reportedPhone} — يحتاج مراجعة عاجلة`,
                'urgent', 'specific', 'admin', 'admin',
            );
        }
    }

    res.json({ success: true, complaint });
});

app.get('/api/complaints', (req, res) => {
    const complaints = db.prepare(`${COMPLAINT_JOIN_SQL} ORDER BY complaints.created_at DESC, complaints.id DESC`).all();
    res.json({ success: true, complaints });
});

app.get('/api/complaints/user/:phone', (req, res) => {
    const complaints = db.prepare(
        `${COMPLAINT_JOIN_SQL} WHERE complaints.reporter_phone = ? ORDER BY complaints.created_at DESC, complaints.id DESC`
    ).all(req.params.phone);
    res.json({ success: true, complaints });
});

app.get('/api/complaints/:id', (req, res) => {
    const complaint = db.prepare(`${COMPLAINT_JOIN_SQL} WHERE complaints.id = ?`).get(req.params.id);

    if (!complaint) {
        return res.json({ success: false, message: 'الشكوى غير موجودة' });
    }

    res.json({ success: true, complaint });
});

app.put('/api/complaints/:id/status', (req, res) => {
    const { status, adminNote } = req.body;

    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id);
    if (!complaint) {
        return res.json({ success: false, message: 'الشكوى غير موجودة' });
    }

    const setsResolvedAt = (status === 'resolved' || status === 'closed') && !complaint.resolved_at;

    if (setsResolvedAt) {
        db.prepare("UPDATE complaints SET status = ?, admin_note = ?, resolved_at = datetime('now') WHERE id = ?")
            .run(status, adminNote ?? complaint.admin_note, req.params.id);
    } else {
        db.prepare('UPDATE complaints SET status = ?, admin_note = ? WHERE id = ?')
            .run(status, adminNote ?? complaint.admin_note, req.params.id);
    }

    const updated = db.prepare(`${COMPLAINT_JOIN_SQL} WHERE complaints.id = ?`).get(req.params.id);
    res.json({ success: true, complaint: updated });
});

app.put('/api/complaints/:id/action', (req, res) => {
    const { actionType, note, duration, replyMessage } = req.body;

    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id);
    if (!complaint) {
        return res.json({ success: false, message: 'الشكوى غير موجودة' });
    }

    let logEntry  = '';
    let newStatus = complaint.status;

    if (actionType === 'resolve') {
        newStatus = 'resolved';
        logEntry  = `تم الحل${note ? ' — ' + note : ''}`;

    } else if (actionType === 'refund') {
        const order = complaint.order_id ? db.prepare('SELECT * FROM orders WHERE id = ?').get(complaint.order_id) : null;
        logEntry = `تم استرداد المبلغ للعميل${order ? ' (' + order.price + ' ريال)' : ''}${note ? ' — ' + note : ''}`;
        if (complaint.reporter_type === 'client') {
            createNotification(
                'تم استرداد مبلغك',
                `تم استرداد مبلغ طلبك${complaint.order_id ? ' رقم #' + complaint.order_id : ''} بعد مراجعة شكواك`,
                'update', 'specific', complaint.reporter_phone, complaint.reporter_phone,
            );
        }

    } else if (actionType === 'warn') {
        if (!complaint.reported_phone) {
            return res.json({ success: false, message: 'ما فيه مُبلَّغ عنه بهذي الشكوى' });
        }
        logEntry = `تم إرسال تحذير${note ? ' — ' + note : ''}`;
        createNotification(
            'تنبيه من إدارة يشجب',
            note || 'تم استلام بلاغ بخصوص سلوكك على المنصة، يرجى الالتزام بسياسات الاستخدام',
            'urgent', 'specific', complaint.reported_phone, complaint.reported_phone,
        );

    } else if (actionType === 'suspend') {
        if (!complaint.reported_phone || !complaint.reported_type) {
            return res.json({ success: false, message: 'ما فيه حساب مُبلَّغ عنه لإيقافه' });
        }
        const days = { day: 1, week: 7, month: 30 }[duration] || 1;
        const suspendedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);

        if (complaint.reported_type === 'provider') {
            db.prepare('UPDATE providers SET is_available = 0, suspended_until = ? WHERE phone = ?').run(suspendedUntil, complaint.reported_phone);
        } else {
            db.prepare('UPDATE users SET suspended_until = ? WHERE phone = ?').run(suspendedUntil, complaint.reported_phone);
        }

        logEntry = `تم إيقاف الحساب حتى ${suspendedUntil}${note ? ' — ' + note : ''}`;
        createNotification(
            'تم إيقاف حسابك مؤقتاً',
            `تم إيقاف حسابك حتى ${suspendedUntil} بسبب مخالفة سياسات المنصة`,
            'urgent', 'specific', complaint.reported_phone, complaint.reported_phone,
        );

    } else if (actionType === 'delete') {
        if (!complaint.reported_phone || !complaint.reported_type) {
            return res.json({ success: false, message: 'ما فيه حساب مُبلَّغ عنه لحذفه' });
        }
        if (complaint.reported_type === 'provider') {
            db.prepare('DELETE FROM providers WHERE phone = ?').run(complaint.reported_phone);
        } else {
            db.prepare('DELETE FROM users WHERE phone = ?').run(complaint.reported_phone);
        }
        logEntry = `تم حذف الحساب نهائياً${note ? ' — ' + note : ''}`;

    } else if (actionType === 'reply') {
        if (!replyMessage || !replyMessage.trim()) {
            return res.json({ success: false, message: 'نص الرد مطلوب' });
        }
        logEntry = `رد للمُبلِّغ: ${replyMessage.trim()}`;
        createNotification('رد الإدارة على بلاغك', replyMessage.trim(), 'update', 'specific', complaint.reporter_phone, complaint.reporter_phone);

    } else if (actionType === 'close') {
        newStatus = 'closed';
        logEntry  = `تم إغلاق البلاغ بدون إجراء${note ? ' — ' + note : ''}`;

    } else {
        return res.json({ success: false, message: 'نوع إجراء غير معروف' });
    }

    const timestamp      = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const newActionTaken = (complaint.action_taken ? complaint.action_taken + '\n' : '') + `[${timestamp}] ${logEntry}`;
    const setsResolvedAt = (newStatus === 'resolved' || newStatus === 'closed') && !complaint.resolved_at;

    if (setsResolvedAt) {
        db.prepare("UPDATE complaints SET status = ?, action_taken = ?, resolved_at = datetime('now') WHERE id = ?")
            .run(newStatus, newActionTaken, req.params.id);
    } else {
        db.prepare('UPDATE complaints SET status = ?, action_taken = ? WHERE id = ?')
            .run(newStatus, newActionTaken, req.params.id);
    }

    const updated = db.prepare(`${COMPLAINT_JOIN_SQL} WHERE complaints.id = ?`).get(req.params.id);
    res.json({ success: true, complaint: updated });
});

// ========== API التقييمات ==========

const REVIEW_JOIN_SQL = `
    SELECT reviews.*, orders.service AS order_service,
        COALESCE(
            (SELECT name FROM users WHERE phone = reviews.reviewer_phone),
            (SELECT name FROM providers WHERE phone = reviews.reviewer_phone)
        ) AS reviewer_name,
        COALESCE(
            (SELECT name FROM users WHERE phone = reviews.reviewed_phone),
            (SELECT name FROM providers WHERE phone = reviews.reviewed_phone)
        ) AS reviewed_name
    FROM reviews
    LEFT JOIN orders ON orders.id = reviews.order_id
`;

app.post('/api/reviews', (req, res) => {
    const { orderId, reviewerPhone, reviewerType, reviewedPhone, reviewedType, rating, comment } = req.body;

    if (!reviewerPhone || !reviewerType || !reviewedPhone || !reviewedType || !rating) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
    }

    const ratingNum = parseInt(rating, 10);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return res.json({ success: false, message: 'التقييم لازم يكون رقم من 1 إلى 5' });
    }

    // تقييم واحد فقط لكل طلب من نفس المُقيِّم
    if (orderId) {
        const existing = db.prepare('SELECT * FROM reviews WHERE order_id = ? AND reviewer_phone = ?').get(orderId, reviewerPhone);
        if (existing) {
            return res.json({ success: false, message: 'تم تقييم هذا الطلب مسبقاً' });
        }
    }

    const result = db.prepare(`
        INSERT INTO reviews (order_id, reviewer_phone, reviewer_type, reviewed_phone, reviewed_type, rating, comment)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(orderId || null, reviewerPhone, reviewerType, reviewedPhone, reviewedType, ratingNum, comment || '');

    if (reviewedType === 'provider') {
        recalculateProviderRating(reviewedPhone);
    }

    // تنبيه فوري للإدارة عند تقييم سلبي (1-2 نجوم)
    if (ratingNum <= 2) {
        createNotification(
            'تقييم سلبي',
            `تقييم ${ratingNum} نجوم من ${reviewerType === 'client' ? 'عميل' : 'مزوّد'} — رقم التقييم #${result.lastInsertRowid}`,
            'urgent', 'specific', 'admin', 'admin',
        );

        // تنبيه عاجل لو تجمّعت 3 تقييمات سلبية ضد نفس المُقيَّم (يُطلق مرة وحدة بالضبط عند الوصول لـ 3)
        const negativeCount = db.prepare('SELECT COUNT(*) AS n FROM reviews WHERE reviewed_phone = ? AND rating <= 2').get(reviewedPhone).n;
        if (negativeCount === 3) {
            createNotification(
                'تكرار تقييمات سلبية',
                `تم استلام 3 تقييمات سلبية ضد ${reviewedType === 'provider' ? 'المزوّد' : 'المستخدم'} صاحب الرقم ${reviewedPhone} — يحتاج مراجعة عاجلة`,
                'urgent', 'specific', 'admin', 'admin',
            );
        }
    }

    const review = db.prepare(`${REVIEW_JOIN_SQL} WHERE reviews.id = ?`).get(result.lastInsertRowid);
    res.json({ success: true, review });
});

app.get('/api/reviews', (req, res) => {
    const reviews = db.prepare(`${REVIEW_JOIN_SQL} ORDER BY reviews.created_at DESC, reviews.id DESC`).all();
    res.json({ success: true, reviews });
});

app.get('/api/reviews/stats', (req, res) => {
    const visible = db.prepare("SELECT rating FROM reviews WHERE is_visible = 1").all();
    const total   = visible.length;
    const avg     = total ? visible.reduce((s, r) => s + r.rating, 0) / total : 0;
    const satisfied   = visible.filter(r => r.rating >= 4).length;
    const unsatisfied = visible.filter(r => r.rating <= 2).length;

    const distribution = {};
    for (let i = 1; i <= 5; i++) {
        const count = visible.filter(r => r.rating === i).length;
        distribution[i] = { count, percent: total ? Math.round((count / total) * 100) : 0 };
    }

    const providerStats = db.prepare(`
        SELECT reviews.reviewed_phone AS phone,
               (SELECT name FROM providers WHERE phone = reviews.reviewed_phone) AS name,
               AVG(reviews.rating) AS avg_rating,
               COUNT(*) AS review_count
        FROM reviews
        WHERE reviews.reviewed_type = 'provider' AND reviews.is_visible = 1
        GROUP BY reviews.reviewed_phone
    `).all().map(p => ({ ...p, avg_rating: Math.round(p.avg_rating * 10) / 10 }));

    const sorted = [...providerStats].sort((a, b) => b.avg_rating - a.avg_rating);

    res.json({
        success: true,
        stats: {
            total,
            avg: Math.round(avg * 10) / 10,
            satisfiedPct: total ? Math.round((satisfied / total) * 100) : 0,
            unsatisfiedPct: total ? Math.round((unsatisfied / total) * 100) : 0,
            distribution,
            topProviders: sorted.slice(0, 3),
            bottomProviders: sorted.slice(-3).reverse(),
        },
    });
});

app.get('/api/reviews/provider/:phone', (req, res) => {
    const reviews = db.prepare(
        `${REVIEW_JOIN_SQL} WHERE reviews.reviewed_phone = ? AND reviews.reviewed_type = 'provider' ORDER BY reviews.created_at DESC, reviews.id DESC`
    ).all(req.params.phone);
    res.json({ success: true, reviews });
});

app.put('/api/reviews/:id/visibility', (req, res) => {
    const { isVisible } = req.body;

    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
    if (!review) {
        return res.json({ success: false, message: 'التقييم غير موجود' });
    }

    db.prepare('UPDATE reviews SET is_visible = ? WHERE id = ?').run(isVisible ? 1 : 0, req.params.id);

    if (review.reviewed_type === 'provider') {
        recalculateProviderRating(review.reviewed_phone);
    }

    const updated = db.prepare(`${REVIEW_JOIN_SQL} WHERE reviews.id = ?`).get(req.params.id);
    res.json({ success: true, review: updated });
});

app.put('/api/reviews/:id/reply', (req, res) => {
    const { reply } = req.body;

    if (!reply || !reply.trim()) {
        return res.json({ success: false, message: 'نص الرد مطلوب' });
    }

    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
    if (!review) {
        return res.json({ success: false, message: 'التقييم غير موجود' });
    }

    db.prepare('UPDATE reviews SET admin_reply = ? WHERE id = ?').run(reply.trim(), req.params.id);

    createNotification('رد الإدارة على تقييمك', reply.trim(), 'update', 'specific', review.reviewer_phone, review.reviewer_phone);

    const updated = db.prepare(`${REVIEW_JOIN_SQL} WHERE reviews.id = ?`).get(req.params.id);
    res.json({ success: true, review: updated });
});

app.put('/api/reviews/:id/flag', (req, res) => {
    const { isFlagged } = req.body;

    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
    if (!review) {
        return res.json({ success: false, message: 'التقييم غير موجود' });
    }

    db.prepare('UPDATE reviews SET is_flagged = ? WHERE id = ?').run(isFlagged ? 1 : 0, req.params.id);

    if (isFlagged) {
        createNotification(
            'تقييم مشبوه',
            `تقييم #${review.id} (${review.rating} نجوم) تم تحديده كمشبوه — يحتاج مراجعة`,
            'urgent', 'specific', 'admin', 'admin',
        );
    }

    const updated = db.prepare(`${REVIEW_JOIN_SQL} WHERE reviews.id = ?`).get(req.params.id);
    res.json({ success: true, review: updated });
});

app.delete('/api/reviews/:id', (req, res) => {
    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
    if (!review) {
        return res.json({ success: false, message: 'التقييم غير موجود' });
    }

    db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);

    if (review.reviewed_type === 'provider') {
        recalculateProviderRating(review.reviewed_phone);
    }

    res.json({ success: true });
});

// ========== API شهادات العملاء ==========

app.post('/api/testimonials', (req, res) => {
    const { clientPhone, clientName, rating, comment, service } = req.body;

    if (!clientPhone || !clientName || !clientName.trim() || !rating || !comment || !comment.trim()) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
    }

    const ratingNum = parseInt(rating, 10);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return res.json({ success: false, message: 'التقييم لازم يكون رقم من 1 إلى 5' });
    }

    if (comment.trim().length < 20) {
        return res.json({ success: false, message: 'نص الشهادة لازم يكون 20 حرف على الأقل' });
    }

    const result = db.prepare(`
        INSERT INTO testimonials (client_phone, client_name, rating, comment, service)
        VALUES (?, ?, ?, ?, ?)
    `).run(clientPhone, clientName.trim(), ratingNum, comment.trim(), service || null);

    const testimonial = db.prepare('SELECT * FROM testimonials WHERE id = ?').get(result.lastInsertRowid);

    res.json({ success: true, testimonial });
});

app.get('/api/testimonials/approved', (req, res) => {
    const testimonials = db.prepare(
        "SELECT * FROM testimonials WHERE status = 'approved' ORDER BY created_at DESC"
    ).all();

    res.json({ success: true, testimonials });
});

app.get('/api/testimonials/all', (req, res) => {
    const testimonials = db.prepare(
        'SELECT * FROM testimonials ORDER BY created_at DESC, id DESC'
    ).all();

    res.json({ success: true, testimonials });
});

app.put('/api/testimonials/:id/status', (req, res) => {
    const { status } = req.body;
    const validStatuses = ['pending', 'approved', 'rejected', 'hidden'];

    if (!validStatuses.includes(status)) {
        return res.json({ success: false, message: 'حالة غير صحيحة' });
    }

    db.prepare('UPDATE testimonials SET status = ? WHERE id = ?').run(status, req.params.id);

    const testimonial = db.prepare('SELECT * FROM testimonials WHERE id = ?').get(req.params.id);

    res.json({ success: true, testimonial });
});

app.delete('/api/testimonials/:id', (req, res) => {
    db.prepare('DELETE FROM testimonials WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// ========== API التقارير المالية ==========

app.get('/api/reports/commissions', (req, res) => {
    const orders = db.prepare('SELECT service, commission, price, created_at FROM orders').all();

    const now   = new Date();
    const today = now.toISOString().slice(0, 10);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const weekStr = startOfWeek.toISOString().slice(0, 10);

    const monthStr = now.toISOString().slice(0, 7);
    const yearStr  = now.toISOString().slice(0, 4);

    let todayTotal = 0, weekTotal = 0, monthTotal = 0, yearTotal = 0, allTotal = 0;
    const byService = {};

    orders.forEach(o => {
        const day = (o.created_at || '').slice(0, 10);
        allTotal += o.commission;

        if (day >= today)     todayTotal += o.commission;
        if (day >= weekStr)   weekTotal  += o.commission;
        if (day.slice(0,7) === monthStr) monthTotal += o.commission;
        if (day.slice(0,4) === yearStr)  yearTotal  += o.commission;

        if (!byService[o.service]) byService[o.service] = { count: 0, commission: 0, revenue: 0 };
        byService[o.service].count++;
        byService[o.service].commission += o.commission;
        byService[o.service].revenue    += o.price;
    });

    res.json({
        success: true,
        today: todayTotal, week: weekTotal, month: monthTotal, year: yearTotal, total: allTotal,
        byService,
    });
});

app.get('/api/reports/payments', (req, res) => {
    const payments = db.prepare(`
        SELECT orders.id, orders.phone, orders.service, orders.price, orders.commission,
               orders.status, orders.provider_name, orders.discount, orders.coupon_code, orders.created_at,
               (orders.price - orders.commission) AS net_to_provider
        FROM orders
        ORDER BY orders.created_at DESC
    `).all();

    res.json({ success: true, payments });
});

// ========== API مركز العمليات المباشر ==========

app.get('/api/operations/live', (req, res) => {
    const activeOrders = db.prepare(`
        SELECT * FROM orders WHERE status IN ('pending', 'accepted') ORDER BY created_at DESC
    `).all();

    const availableProvidersCount = db.prepare(
        'SELECT COUNT(*) AS n FROM providers WHERE is_available = 1'
    ).get().n;

    const today = new Date().toISOString().slice(0, 10);
    const todayRevenue = db.prepare(
        "SELECT COALESCE(SUM(price), 0) AS total FROM orders WHERE created_at LIKE ?"
    ).get(today + '%').total;

    // متوسط وقت القبول (بالدقائق) من آخر 50 طلب له وقت قبول مسجّل
    const acceptedSample = db.prepare(`
        SELECT created_at, accepted_at FROM orders
        WHERE accepted_at IS NOT NULL
        ORDER BY accepted_at DESC LIMIT 50
    `).all();

    let avgAcceptanceMinutes = null;
    if (acceptedSample.length) {
        const totalMinutes = acceptedSample.reduce((sum, o) => {
            const created  = new Date(o.created_at.replace(' ', 'T') + 'Z').getTime();
            const accepted = new Date(o.accepted_at.replace(' ', 'T') + 'Z').getTime();
            return sum + Math.max(0, (accepted - created) / 60000);
        }, 0);
        avgAcceptanceMinutes = Math.round(totalMinutes / acceptedSample.length);
    }

    // تنبيهات: طلبات بدون مزود تجاوزت 5 أو 10 دقائق
    const now = Date.now();
    const alerts = [];

    activeOrders.forEach(o => {
        if (o.provider_id) return;
        const ageMinutes = Math.round((now - new Date(o.created_at.replace(' ', 'T') + 'Z').getTime()) / 60000);

        if (ageMinutes > 24 * 60) return; // طلبات قديمة جداً (أكثر من يوم) تُستبعد من تنبيهات "الآن" — تبقى بجدول الطلبات فقط

        if (ageMinutes >= 10) {
            alerts.push({ level: 'red', type: 'order_unassigned', orderId: o.id, message: `الطلب #${o.id} (${o.service}) بدون مزود منذ ${ageMinutes} دقيقة` });
        } else if (ageMinutes >= 5) {
            alerts.push({ level: 'yellow', type: 'order_unassigned', orderId: o.id, message: `الطلب #${o.id} (${o.service}) بدون مزود منذ ${ageMinutes} دقيقة` });
        }
    });

    // تنبيهات: مزودون انضموا خلال آخر 24 ساعة يحتاجون مراجعة
    const dayAgoIso = new Date(now - 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    const newProviders = db.prepare(
        'SELECT * FROM providers WHERE created_at >= ? ORDER BY created_at DESC'
    ).all(dayAgoIso);

    newProviders.forEach(p => {
        alerts.push({ level: 'blue', type: 'provider_review', providerId: p.id, message: `مزود جديد "${p.name}" يحتاج مراجعة توثيق` });
    });

    res.json({
        success: true,
        stats: {
            activeOrders: activeOrders.length,
            availableProviders: availableProvidersCount,
            avgAcceptanceMinutes,
            todayRevenue,
        },
        alerts,
    });
});

// أخطاء رفع الملفات (نوع غير مسموح، حجم كبير)
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError || err) {
        return res.json({ success: false, message: 'تعذّر رفع الملف — تأكد إنه صورة أو PDF أقل من 5MB' });
    }
    next();
});

// صفحة 404
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '404.html'));
});

// ========== فحص دوري: طلبات بدون مزود منذ أكثر من 10 دقائق (إشعار للإدارة) ==========
// Set بالذاكرة لتفادي تكرار نفس الإشعار لنفس الطلب (يُعاد ضبطها لو أعيد تشغيل السيرفر)
const notifiedStaleOrders = new Set();

function checkStaleOrders() {
    const staleOrders = db.prepare(`
        SELECT * FROM orders
        WHERE provider_id IS NULL AND status = 'pending'
        AND created_at <= datetime('now', '-10 minutes')
    `).all();

    staleOrders.forEach(o => {
        if (notifiedStaleOrders.has(o.id)) return;
        notifiedStaleOrders.add(o.id);

        createNotification(
            'طلب بدون مزود',
            `الطلب #${o.id} (${o.service}) بدون مزود منذ أكثر من 10 دقائق — يحتاج تدخل`,
            'urgent', 'specific', 'admin', 'admin',
        );
    });
}

setInterval(checkStaleOrders, 5 * 60 * 1000);

// ========== فحص دوري: شكاوى لم تُحل خلال 24 ساعة (إشعار للإدارة) ==========
const notifiedStaleComplaints = new Set();

function checkStaleComplaints() {
    const staleComplaints = db.prepare(`
        SELECT * FROM complaints
        WHERE status IN ('new', 'reviewing')
        AND created_at <= datetime('now', '-24 hours')
    `).all();

    staleComplaints.forEach(c => {
        if (notifiedStaleComplaints.has(c.id)) return;
        notifiedStaleComplaints.add(c.id);

        createNotification(
            'شكوى بدون حل',
            `الشكوى #${c.id} (${c.type}) لسه بدون حل منذ أكثر من 24 ساعة — تحتاج مراجعة`,
            'urgent', 'specific', 'admin', 'admin',
        );
    });
}

setInterval(checkStaleComplaints, 5 * 60 * 1000);

// ========== فحص دوري: إعادة تفعيل الحسابات الموقوفة مؤقتاً بعد انتهاء مدتها ==========
function reactivateSuspendedAccounts() {
    db.prepare(`
        UPDATE providers SET is_available = 1, suspended_until = NULL
        WHERE suspended_until IS NOT NULL AND suspended_until <= datetime('now')
    `).run();

    db.prepare(`
        UPDATE users SET suspended_until = NULL
        WHERE suspended_until IS NOT NULL AND suspended_until <= datetime('now')
    `).run();
}

setInterval(reactivateSuspendedAccounts, 5 * 60 * 1000);

// ========== تشغيل السيرفر ==========
app.listen(PORT, () => {
    console.log(`
🚀 سيرفر يشجب شغال!
🌐 افتح المتصفح على: http://localhost:${PORT}
📡 API جاهز على: http://localhost:${PORT}/api
    `);
});