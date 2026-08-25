// سيرفر يشجب — مع قاعدة البيانات

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
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
    const { phone, service, address, price, productId, lat, lng } = req.body;
    let   { providerId, providerName } = req.body;

    if (!phone || !service || !address) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
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
        INSERT INTO orders (phone, service, address, price, commission, provider_id, provider_name, provider_phone, product_id, lat, lng)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(phone, service, address, price, commission, providerId || null, providerName || null, providerPhone, productId || null, lat || null, lng || null);

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
    order.provider_rating = providerRating;

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

    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);

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

    console.log(`✅ مزود جديد #${result.lastInsertRowid} — ${fullName} — ${serviceType}`);

    res.json({ success: true, id: result.lastInsertRowid });
});

app.get('/api/providers', (req, res) => {
    const providers = db.prepare('SELECT * FROM providers ORDER BY created_at DESC').all();
    res.json({ success: true, providers });
});
// جلب طلبات مستخدم محدد
app.get('/api/orders/user/:phone', (req, res) => {
    const orders = db.prepare(
        'SELECT * FROM orders WHERE phone = ? ORDER BY created_at DESC'
    ).all(req.params.phone);

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
               providers.level  AS provider_level
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
});// ========== تشغيل السيرفر ==========
app.listen(PORT, () => {
    console.log(`
🚀 سيرفر يشجب شغال!
🌐 افتح المتصفح على: http://localhost:${PORT}
📡 API جاهز على: http://localhost:${PORT}/api
    `);
});