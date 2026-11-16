// سيرفر عتاد — مع قاعدة البيانات

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const sharp   = require('sharp');
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
        const allowed = file.mimetype === 'image/jpeg' || file.mimetype === 'application/pdf';
        cb(allowed ? null : new Error('نوع ملف غير مسموح — يُقبل PDF أو JPG فقط'), allowed);
    },
});

// ══ علامة مائية (لوقو المنصة) على صور الإعلانات المرفوعة ══

let transparentLogoBuffer = null;

// يحوّل اللوقو الأصلي (خلفيته سوداء تقريباً نقية، بدون قناة شفافية) إلى PNG بخلفية شفافة فعلياً —
// عبر معالجة البكسلات مباشرة (أي بكسل قريب من الأسود يصير شفاف بالكامل) — نتيجة محسوبة مرة وحدة ومُعاد استخدامها
async function getTransparentLogo() {
    if (transparentLogoBuffer) return transparentLogoBuffer;

    const { data, info } = await sharp(path.join(__dirname, 'images', 'logo.jpg'))
        .ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 35 && data[i + 1] < 35 && data[i + 2] < 35) data[i + 3] = 0;
    }

    transparentLogoBuffer = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
        .png().toBuffer();
    return transparentLogoBuffer;
}

// يركّب اللوقو الشفاف مباشرة (بدون أي خلفية أو إطار) بزاوية الصورة اليسرى السفلى، قريب من الحافة فعلياً،
// ويعدّل الملف بمكانه مباشرة — يتجاهل أي خطأ بصمت (الصورة الأصلية بدون علامة مائية أفضل من فشل الرفع بالكامل)
async function addWatermark(filePath) {
    try {
        const transparentLogo = await getTransparentLogo();
        // نقرأ الملف الأصلي بالذاكرة أولاً (بدل تمرير المسار مباشرة لـ sharp) — تمرير نفس المسار كمدخل ومخرج بنفس الوقت
        // يسبّب قفل ملف (EBUSY/UNKNOWN error) على ويندوز لأن libvips يبقي الملف مفتوحاً للقراءة أثناء محاولة الكتابة عليه
        const inputBuffer = fs.readFileSync(filePath);
        const image = sharp(inputBuffer).rotate(); // تصحيح الدوران حسب EXIF قبل أي حساب مواضع (صور الجوال)
        const meta  = await image.metadata();

        const logoWidth   = Math.round(Math.max(120, Math.min(meta.width * 0.22, 260)));
        const resizedLogo = await sharp(transparentLogo).resize({ width: logoWidth }).toBuffer();
        const logoMeta    = await sharp(resizedLogo).metadata();

        const margin = Math.round(meta.width * 0.012);
        const output = await image
            .composite([{ input: resizedLogo, left: margin, top: meta.height - logoMeta.height - margin }])
            .jpeg({ quality: 88 })
            .toBuffer();

        fs.writeFileSync(filePath, output);
    } catch (e) {
        console.error('تعذّر إضافة العلامة المائية لصورة إعلان:', e.message);
    }
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

// ══ اسم العضوية (@username) ══

const RESERVED_USERNAMES = ['admin', 'ghawth', 'support'];

function isValidUsernameFormat(username) {
    return typeof username === 'string' && /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

// توليد اسم مستخدم تلقائي أول تسجيل دخول ناجح: user + آخر 6 أرقام من الجوال — مع تفادي أي تصادم نادر (أرقام مختلفة بنفس آخر 6 أرقام)
function generateUsernameFromPhone(phone) {
    const base = 'user' + phone.slice(-6);
    let candidate = base;
    let counter = 2;
    while (db.prepare('SELECT 1 FROM users WHERE username = ?').get(candidate)) {
        candidate = `${base}_${counter}`;
        counter++;
    }
    return candidate;
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

    const provider = db.prepare('SELECT suspended_until, status FROM providers WHERE phone = ?').get(phone);
    if (provider && provider.suspended_until && new Date(provider.suspended_until.replace(' ', 'T') + 'Z') > new Date()) {
        return res.json({ success: false, message: `حساب المزوّد موقوف مؤقتاً حتى ${provider.suspended_until}` });
    }

    db.prepare('UPDATE users SET verified = 1 WHERE phone = ?').run(phone);

    // أول تسجيل دخول ناجح لمستخدم ماله اسم عضوية بعد — يُنشأ تلقائياً (user + آخر 6 أرقام من الجوال)
    let username = user.username;
    if (!username) {
        username = generateUsernameFromPhone(phone);
        db.prepare('UPDATE users SET username = ? WHERE phone = ?').run(username, phone);
    }

    // isProvider: يستخدمها login.html بوضع الإعلانات (دخول موحّد بدون تبويبي عميل/مزود) لتحديد النوع تلقائياً بدل اختيار المستخدم اليدوي
    const isProvider = !!(provider && provider.status === 'approved');
    res.json({ success: true, message: 'تم تسجيل الدخول بنجاح', phone, name: user.name, avatarPath: user.avatar_path, username, isProvider });
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

// تغيير البريد الإلكتروني (profile.html)
app.put('/api/users/:phone/email', (req, res) => {
    const { email } = req.body;
    const { phone } = req.params;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.json({ success: false, message: 'البريد الإلكتروني غير صحيح' });
    }

    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (!user) {
        return res.json({ success: false, message: 'المستخدم غير موجود' });
    }

    db.prepare('UPDATE users SET email = ? WHERE phone = ?').run(email.trim(), phone);

    res.json({ success: true, email: email.trim() });
});

// التحقق من توفر اسم مستخدم معيّن (فحص فوري أثناء الكتابة بـ profile.html) — بدون أي تعديل فعلي
app.get('/api/users/check-username/:username', (req, res) => {
    const { username } = req.params;

    if (!isValidUsernameFormat(username) || RESERVED_USERNAMES.includes(username.toLowerCase())) {
        return res.json({ available: false });
    }

    const existing = db.prepare('SELECT phone FROM users WHERE username = ?').get(username);
    res.json({ available: !existing });
});

// تغيير اسم العضوية (@username) — مرة كل 30 يوم بالضبط
app.put('/api/users/:phone/username', (req, res) => {
    const { phone }    = req.params;
    const { username } = req.body;

    if (!isValidUsernameFormat(username)) {
        return res.json({ success: false, message: 'اسم المستخدم لازم يكون 3-20 حرف إنجليزي أو رقم أو _ فقط، بدون مسافات' });
    }

    if (RESERVED_USERNAMES.includes(username.toLowerCase())) {
        return res.json({ success: false, message: 'اسم المستخدم هذا محجوز' });
    }

    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (!user) {
        return res.json({ success: false, message: 'المستخدم غير موجود' });
    }

    if (user.username === username) {
        return res.json({ success: false, message: 'هذا اسم المستخدم الحالي أصلاً' });
    }

    if (user.username_changed_at) {
        const nextAllowed = new Date(user.username_changed_at.replace(' ', 'T') + 'Z');
        nextAllowed.setDate(nextAllowed.getDate() + 30);
        if (nextAllowed > new Date()) {
            return res.json({ success: false, message: `يمكنك تغيير اسم العضوية مرة كل 30 يوم — حاول بعد ${nextAllowed.toLocaleDateString('ar-SA')}` });
        }
    }

    const existing = db.prepare('SELECT phone FROM users WHERE username = ?').get(username);
    if (existing) {
        return res.json({ success: false, message: 'اسم المستخدم مستخدم من قبل' });
    }

    db.prepare("UPDATE users SET username = ?, username_changed_at = datetime('now') WHERE phone = ?").run(username, phone);

    res.json({ success: true, username });
});

// ══ توثيق الحسابات (علامة ✅ — للإدارة فقط) ══

// توثيق حساب — body اختياري: { adminUsername } لتسجيل اسم الموظف/المدير اللي نفّذ التوثيق
app.put('/api/users/:phone/verify', (req, res) => {
    const { phone } = req.params;
    const { adminUsername } = req.body || {};

    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (!user) {
        return res.json({ success: false, message: 'المستخدم غير موجود' });
    }

    db.prepare("UPDATE users SET is_verified = 1, verified_at = datetime('now'), verified_by = ? WHERE phone = ?")
        .run(adminUsername || 'admin', phone);

    createNotification('تم توثيق حسابك ✅', 'تهانينا! حسابك موثق الآن بمنصة عتاد', 'update', 'specific', phone, phone);

    res.json({ success: true });
});

// إلغاء توثيق حساب
app.put('/api/users/:phone/unverify', (req, res) => {
    const { phone } = req.params;

    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (!user) {
        return res.json({ success: false, message: 'المستخدم غير موجود' });
    }

    db.prepare("UPDATE users SET is_verified = 0, verified_at = NULL, verified_by = NULL WHERE phone = ?").run(phone);

    res.json({ success: true });
});

// رفع صورة شخصية (أفاتار) — نفس قيود الملفات المستخدمة لمستندات المزودين (JPG أو PDF فقط، ≤5MB)، موحّدة لكل المستخدمين (عميل/مزوّد)
app.put('/api/users/:phone/avatar', upload.single('avatar'), (req, res) => {
    const { phone } = req.params;

    if (!req.file) {
        return res.json({ success: false, message: 'يرجى اختيار صورة' });
    }

    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (!user) {
        return res.json({ success: false, message: 'المستخدم غير موجود' });
    }

    const avatarPath = `/uploads/${req.file.filename}`;
    db.prepare('UPDATE users SET avatar_path = ? WHERE phone = ?').run(avatarPath, phone);

    res.json({ success: true, avatarPath });
});

// حذف الصورة الشخصية (رجوع للأيقونة الافتراضية) — لا يحذف الملف الفعلي من uploads، نفس فلسفة عدم-التنظيف المعتمدة بباقي رفع الملفات بالمشروع
app.delete('/api/users/:phone/avatar', (req, res) => {
    const { phone } = req.params;

    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (!user) {
        return res.json({ success: false, message: 'المستخدم غير موجود' });
    }

    db.prepare('UPDATE users SET avatar_path = NULL WHERE phone = ?').run(phone);

    res.json({ success: true });
});

// تغيير رقم الجوال بعد التحقق من OTP المُرسَل للرقم الجديد (نفس POST /api/auth/send-otp)،
// مع ترحيل كل البيانات المرتبطة بالرقم القديم (الطلبات، الإعلانات، الإشعارات، إلخ) للرقم الجديد
app.put('/api/users/:phone/change-phone', (req, res) => {
    const oldPhone = req.params.phone;
    const { newPhone, otp } = req.body;

    if (!newPhone || newPhone.length !== 9 || !otp) {
        return res.json({ success: false, message: 'بيانات غير صحيحة' });
    }

    if (newPhone === oldPhone) {
        return res.json({ success: false, message: 'هذا هو رقمك الحالي' });
    }

    const currentUser = db.prepare('SELECT * FROM users WHERE phone = ?').get(oldPhone);
    if (!currentUser) {
        return res.json({ success: false, message: 'المستخدم غير موجود' });
    }

    const newPhoneRow = db.prepare('SELECT * FROM users WHERE phone = ?').get(newPhone);
    if (!newPhoneRow || newPhoneRow.otp !== otp) {
        return res.json({ success: false, message: 'رمز التحقق غير صحيح' });
    }

    // الرقم الجديد مستخدم أصلاً بحساب حقيقي آخر (مختلف عن صف التحقق المؤقت اللي أنشأه send-otp)
    if (newPhoneRow.verified) {
        return res.json({ success: false, message: 'هذا الرقم مستخدم بحساب آخر' });
    }

    const migrate = db.transaction(() => {
        db.prepare('DELETE FROM users WHERE phone = ?').run(newPhone);
        db.prepare('UPDATE users SET phone = ? WHERE phone = ?').run(newPhone, oldPhone);
        db.prepare('UPDATE orders SET phone = ? WHERE phone = ?').run(newPhone, oldPhone);
        db.prepare('UPDATE orders SET provider_phone = ? WHERE provider_phone = ?').run(newPhone, oldPhone);
        db.prepare('UPDATE providers SET phone = ? WHERE phone = ?').run(newPhone, oldPhone);
        db.prepare('UPDATE ads SET provider_phone = ? WHERE provider_phone = ?').run(newPhone, oldPhone);
        db.prepare('UPDATE chats SET sender_phone = ? WHERE sender_phone = ?').run(newPhone, oldPhone);
        db.prepare('UPDATE notifications SET receiver_phone = ? WHERE receiver_phone = ?').run(newPhone, oldPhone);
        db.prepare('UPDATE notifications SET target_phone = ? WHERE target_phone = ?').run(newPhone, oldPhone);
        db.prepare('UPDATE complaints SET reporter_phone = ? WHERE reporter_phone = ?').run(newPhone, oldPhone);
        db.prepare('UPDATE complaints SET reported_phone = ? WHERE reported_phone = ?').run(newPhone, oldPhone);
        db.prepare('UPDATE reviews SET reviewer_phone = ? WHERE reviewer_phone = ?').run(newPhone, oldPhone);
        db.prepare('UPDATE reviews SET reviewed_phone = ? WHERE reviewed_phone = ?').run(newPhone, oldPhone);
        db.prepare('UPDATE testimonials SET client_phone = ? WHERE client_phone = ?').run(newPhone, oldPhone);
        db.prepare('UPDATE invoices SET client_phone = ? WHERE client_phone = ?').run(newPhone, oldPhone);
        db.prepare('UPDATE ad_reviews SET reviewer_phone = ? WHERE reviewer_phone = ?').run(newPhone, oldPhone);
    });

    try {
        migrate();
    } catch (err) {
        console.error(err);
        return res.json({ success: false, message: 'تعذّر تغيير رقم الجوال' });
    }

    res.json({ success: true, phone: newPhone });
});

// حذف الحساب نهائياً (profile.html) — يحذف المستخدم وكل إعلاناته (لو كان مزوّد إعلانات)
app.delete('/api/users/:phone', (req, res) => {
    const { phone } = req.params;

    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (!user) {
        return res.json({ success: false, message: 'المستخدم غير موجود' });
    }

    const adIds = db.prepare('SELECT id FROM ads WHERE provider_phone = ?').all(phone).map(a => a.id);

    const deleteAll = db.transaction(() => {
        adIds.forEach(id => db.prepare('DELETE FROM ad_reviews WHERE ad_id = ?').run(id));
        db.prepare('DELETE FROM ads WHERE provider_phone = ?').run(phone);
        db.prepare('DELETE FROM users WHERE phone = ?').run(phone);
    });
    deleteAll();

    res.json({ success: true });
});

// إيقاف/تفعيل حساب مستخدم مباشرة (لوحة الإدارة — إدارة الأعضاء بوضع الإعلانات)، نفس خريطة المدد المستخدمة بإجراء الشكاوى "suspend"
app.put('/api/users/:phone/suspend', (req, res) => {
    const { duration } = req.body;
    const days = { day: 1, week: 7, month: 30 }[duration];
    if (!days) return res.json({ success: false, message: 'مدة غير صحيحة' });

    const suspendedUntil = new Date(Date.now() + days * 86400000).toISOString().slice(0, 19).replace('T', ' ');
    db.prepare('UPDATE users SET suspended_until = ? WHERE phone = ?').run(suspendedUntil, req.params.phone);
    res.json({ success: true, suspendedUntil });
});

app.put('/api/users/:phone/unsuspend', (req, res) => {
    db.prepare('UPDATE users SET suspended_until = NULL WHERE phone = ?').run(req.params.phone);
    res.json({ success: true });
});

app.get('/api/users', (req, res) => {
    const users = db.prepare(`
        SELECT id, phone, name, email, avatar_path, username, verified, is_verified, verified_at, verified_by, suspended_until, created_at,
            (SELECT balance FROM user_coins WHERE user_coins.phone = users.phone) AS coins_balance,
            (SELECT COUNT(*) FROM ads WHERE ads.provider_phone = users.phone) AS ads_count
        FROM users
    `).all();
    res.json({ success: true, users });
});

app.get('/api/providers', (req, res) => {
    const providers = db.prepare('SELECT * FROM providers ORDER BY created_at DESC').all();
    res.json({ success: true, providers });
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

// ========== API أقسام الإعلانات (جدول ديناميكي — لوحة الإدارة "إعدادات الأقسام" بوضع الإعلانات) ==========

app.get('/api/ad-categories', (req, res) => {
    const categories = db.prepare('SELECT * FROM ad_categories ORDER BY sort_order ASC, id ASC').all();
    res.json({ success: true, categories });
});

app.get('/api/ad-categories/active', (req, res) => {
    const categories = db.prepare('SELECT * FROM ad_categories WHERE is_active = 1 ORDER BY sort_order ASC, id ASC').all();
    res.json({ success: true, categories });
});

app.post('/api/ad-categories', (req, res) => {
    const { name, nameEn, nameUr, icon, minPrice, sortOrder } = req.body;
    if (!name || !icon) return res.json({ success: false, message: 'بيانات ناقصة' });

    const existing = db.prepare('SELECT id FROM ad_categories WHERE name = ?').get(name);
    if (existing) return res.json({ success: false, message: 'يوجد قسم بنفس الاسم مسبقاً' });

    const result = db.prepare(`
        INSERT INTO ad_categories (name, name_en, name_ur, icon, min_price, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, nameEn || null, nameUr || null, icon, minPrice || null, sortOrder || 0);

    const category = db.prepare('SELECT * FROM ad_categories WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, category });
});

app.put('/api/ad-categories/:id', (req, res) => {
    const cat = db.prepare('SELECT * FROM ad_categories WHERE id = ?').get(req.params.id);
    if (!cat) return res.json({ success: false, message: 'القسم غير موجود' });

    if (req.body.name && req.body.name !== cat.name) {
        const dup = db.prepare('SELECT id FROM ad_categories WHERE name = ? AND id != ?').get(req.body.name, req.params.id);
        if (dup) return res.json({ success: false, message: 'يوجد قسم بنفس الاسم مسبقاً' });
    }

    db.prepare(`
        UPDATE ad_categories SET name = ?, name_en = ?, name_ur = ?, icon = ?, min_price = ?, sort_order = ?, is_active = ?
        WHERE id = ?
    `).run(
        req.body.name ?? cat.name,
        req.body.nameEn !== undefined ? req.body.nameEn : cat.name_en,
        req.body.nameUr !== undefined ? req.body.nameUr : cat.name_ur,
        req.body.icon ?? cat.icon,
        req.body.minPrice !== undefined ? req.body.minPrice : cat.min_price,
        req.body.sortOrder !== undefined ? req.body.sortOrder : cat.sort_order,
        req.body.isActive !== undefined ? (req.body.isActive ? 1 : 0) : cat.is_active,
        req.params.id,
    );

    const updated = db.prepare('SELECT * FROM ad_categories WHERE id = ?').get(req.params.id);
    res.json({ success: true, category: updated });
});

app.delete('/api/ad-categories/:id', (req, res) => {
    db.prepare('DELETE FROM ad_categories WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// ========== API إعدادات النظام (قسم "النظام والسياسات" بلوحة الإدارة) ==========

app.get('/api/settings', (req, res) => {
    const rows = db.prepare('SELECT key, value FROM system_settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value === 'true'; });
    res.json({ success: true, settings });
});

app.put('/api/settings/:key', (req, res) => {
    const { value } = req.body;

    const existing = db.prepare('SELECT * FROM system_settings WHERE key = ?').get(req.params.key);
    if (!existing) {
        return res.json({ success: false, message: 'الإعداد غير موجود' });
    }

    db.prepare("UPDATE system_settings SET value = ?, updated_at = datetime('now') WHERE key = ?")
        .run(value ? 'true' : 'false', req.params.key);

    res.json({ success: true, key: req.params.key, value: !!value });
});

// النظام النشط حالياً (paid أو ads) — يحدده مفتاح ads_system فقط (تفعيله يبدّل الواجهة لوضع الإعلانات)
app.get('/api/settings/active-system', (req, res) => {
    const row = db.prepare("SELECT value FROM system_settings WHERE key = 'ads_system'").get();
    const adsActive = !!row && row.value === 'true';
    res.json({ success: true, activeSystem: adsActive ? 'ads' : 'paid' });
});

// ========== API الإعدادات الرقمية العامة (app_config — تكلفة/مدة تصدير الإعلان، نسبة/مهلة رسوم المعاهدة) ==========
// جدول منفصل عمداً عن system_settings البوليني أعلاه — تفادي أي خطر على مفتاحَي ads_system/paid_system الحرجَين

app.get('/api/config', (req, res) => {
    const rows = db.prepare('SELECT key, value FROM app_config').all();
    const config = {};
    rows.forEach(r => { config[r.key] = r.value; });
    res.json({ success: true, config });
});

app.put('/api/config/:key', (req, res) => {
    const { value } = req.body;
    const existing = db.prepare('SELECT * FROM app_config WHERE key = ?').get(req.params.key);
    if (!existing) return res.json({ success: false, message: 'الإعداد غير موجود' });

    db.prepare("UPDATE app_config SET value = ?, updated_at = datetime('now') WHERE key = ?").run(String(value), req.params.key);
    res.json({ success: true, key: req.params.key, value: String(value) });
});

// ========== API ترجمات نظام تغيير اللغة (لوحة الإدارة — إعدادات اللغات) ==========

app.get('/api/translations', (req, res) => {
    const translations = db.prepare('SELECT * FROM translations ORDER BY id ASC').all();
    res.json({ success: true, translations });
});

app.put('/api/translations/:key', (req, res) => {
    const { en, ur } = req.body;
    const existing = db.prepare('SELECT * FROM translations WHERE ar_key = ?').get(req.params.key);
    if (!existing) return res.json({ success: false, message: 'المفتاح غير موجود' });

    db.prepare("UPDATE translations SET en = ?, ur = ?, updated_at = datetime('now') WHERE ar_key = ?")
        .run(en ?? existing.en, ur ?? existing.ur, req.params.key);

    const updated = db.prepare('SELECT * FROM translations WHERE ar_key = ?').get(req.params.key);
    res.json({ success: true, translation: updated });
});

// ========== API الكلمات المحظورة (فلتر محتوى اختياري — عناوين/أوصاف الإعلانات والتعليقات) ==========

// true لو النص يحتوي كلمة محظورة واحدة على الأقل (تطابق جزئي، غير حساس لحالة الأحرف) — ما يشتغل إلا لو مفتاح banned_words_filter مفعّل
function containsBannedWord(text) {
    if (!text) return false;
    const filterEnabled = db.prepare("SELECT value FROM system_settings WHERE key = 'banned_words_filter'").get();
    if (!filterEnabled || filterEnabled.value !== 'true') return false;

    const words = db.prepare('SELECT word FROM banned_words').all().map(w => w.word.toLowerCase());
    if (!words.length) return false;

    const lowerText = text.toLowerCase();
    return words.some(w => lowerText.includes(w));
}

app.get('/api/banned-words', (req, res) => {
    const words = db.prepare('SELECT * FROM banned_words ORDER BY word ASC').all();
    res.json({ success: true, words });
});

app.post('/api/banned-words', (req, res) => {
    const { word } = req.body;
    if (!word || !word.trim()) return res.json({ success: false, message: 'بيانات ناقصة' });

    const existing = db.prepare('SELECT id FROM banned_words WHERE word = ?').get(word.trim().toLowerCase());
    if (existing) return res.json({ success: false, message: 'الكلمة موجودة مسبقاً' });

    db.prepare('INSERT INTO banned_words (word) VALUES (?)').run(word.trim().toLowerCase());
    res.json({ success: true });
});

app.delete('/api/banned-words/:id', (req, res) => {
    db.prepare('DELETE FROM banned_words WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// ========== API إعلانات "منصة عتاد معاهدة" ==========

const AD_JOIN_SQL = `
    SELECT ads.*,
        (SELECT ROUND(AVG(rating), 1) FROM ad_reviews WHERE ad_reviews.ad_id = ads.id) AS avg_rating,
        (SELECT COUNT(*) FROM ad_reviews WHERE ad_reviews.ad_id = ads.id) AS reviews_count,
        (SELECT COUNT(*) FROM comments WHERE comments.ad_id = ads.id) AS comments_count,
        (SELECT username FROM users WHERE users.phone = ads.provider_phone) AS provider_username,
        (SELECT is_verified FROM users WHERE users.phone = ads.provider_phone) AS provider_is_verified
    FROM ads
`;

app.post('/api/ads', (req, res) => {
    const { providerPhone, providerName, category, adType, title, description, priceFrom, priceTo, city, district, whatsapp, acceptedCovenant, equipmentType } = req.body;
    const type = adType === 'sale' ? 'sale' : 'service';

    if (!providerPhone || !category || !title || !priceFrom || !city) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
    }

    // قسم "معدات ثقيلة" يتطلب تحديد نوع العدة (يُستخدم لفلترة "اختر العدة" بالصفحة الرئيسية)
    if (category === 'معدات ثقيلة' && !equipmentType) {
        return res.json({ success: false, message: 'يرجى اختيار نوع العدة' });
    }

    // كل مزوّد إعلان واحد فقط لكل قسم ونوع (خدمة/بيع) — يقدر ينشر إعلان خدمة وإعلان بيع بنفس القسم
    const existing = db.prepare('SELECT * FROM ads WHERE provider_phone = ? AND category = ? AND ad_type = ?').get(providerPhone, category, type);
    if (existing) {
        return res.json({
            success: false,
            message: 'عندك إعلان في هذا القسم مسبقاً — عدّله بدل إنشاء إعلان جديد',
            existingAdId: existing.id,
        });
    }

    // لازم يوافق على معاهدة عتاد قبل نشر أي إعلان جديد (راجع "معاهدة عتاد" بالتوثيق)
    if (!acceptedCovenant) {
        return res.json({ success: false, message: 'يجب الموافقة على معاهدة عتاد قبل نشر الإعلان' });
    }

    // فلتر الكلمات المحظورة (اختياري — يشتغل فقط لو banned_words_filter مفعّل من لوحة الإدارة)
    if (containsBannedWord(title) || containsBannedWord(description)) {
        return res.json({ success: false, message: 'يحتوي الإعلان على كلمات غير مسموح بها، يرجى تعديل المحتوى' });
    }

    const result = db.prepare(`
        INSERT INTO ads (provider_phone, provider_name, category, ad_type, title, description, price_from, price_to, city, district, whatsapp, equipment_type, accepted_covenant, covenant_accepted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
    `).run(
        providerPhone, providerName || null, category, type, title, description || '',
        priceFrom, priceTo || null, city, district || null, whatsapp || providerPhone, equipmentType || null,
    );

    const ad = db.prepare(`${AD_JOIN_SQL} WHERE ads.id = ?`).get(result.lastInsertRowid);
    res.json({ success: true, ad });
});

app.get('/api/ads', (req, res) => {
    const { category, city, district, price_from, price_to, includeInactive, providerPhone, exclude, limit, equipment_type, ad_type } = req.query;

    let sql = `${AD_JOIN_SQL} WHERE 1=1`;
    const params = [];

    if (!includeInactive) { sql += ' AND ads.is_active = 1'; }
    if (category)          { sql += ' AND ads.category = ?'; params.push(category); }
    if (ad_type)            { sql += ' AND ads.ad_type = ?'; params.push(ad_type); }
    if (equipment_type)    { sql += ' AND ads.equipment_type = ?'; params.push(equipment_type); }
    if (city)              { sql += ' AND ads.city = ?'; params.push(city); }
    if (district)          { sql += ' AND ads.district LIKE ?'; params.push(`%${district}%`); }
    if (price_from)        { sql += ' AND ads.price_from >= ?'; params.push(Number(price_from)); }
    if (price_to)          { sql += ' AND ads.price_from <= ?'; params.push(Number(price_to)); }
    if (providerPhone)     { sql += ' AND ads.provider_phone = ?'; params.push(providerPhone); }
    if (exclude)            { sql += ' AND ads.id != ?'; params.push(Number(exclude)); }

    // المتصدرة (is_featured) أولاً دايماً، ثم الأعلى تقييماً، ثم الأحدث (الإعلانات بدون تقييم تُعامل كأقل أولوية من المقيَّمة، لكن تبقى مرتبة بالأحدث بينها)
    sql += ' ORDER BY ads.is_featured DESC, (avg_rating IS NULL) ASC, avg_rating DESC, ads.created_at DESC';

    if (limit) { sql += ' LIMIT ?'; params.push(Number(limit)); }

    const ads = db.prepare(sql).all(...params);
    res.json({ success: true, ads });
});

// إحصائيات إعلانات مزوّد معيّن (بطاقات الإحصائيات بـ provider.html بوضع الإعلانات)
app.get('/api/ads/provider/:phone/stats', (req, res) => {
    const ads = db.prepare('SELECT is_active, views_count FROM ads WHERE provider_phone = ?').all(req.params.phone);

    const active_count   = ads.filter(a => a.is_active).length;
    const inactive_count = ads.filter(a => !a.is_active).length;
    const total_views    = ads.reduce((sum, a) => sum + a.views_count, 0);

    res.json({ success: true, active_count, inactive_count, total_views });
});

app.get('/api/ads/:id', (req, res) => {
    const ad = db.prepare(`${AD_JOIN_SQL} WHERE ads.id = ?`).get(req.params.id);
    if (!ad) return res.json({ success: false, message: 'الإعلان غير موجود' });

    db.prepare('UPDATE ads SET views_count = views_count + 1 WHERE id = ?').run(ad.id);
    ad.views_count += 1;

    res.json({ success: true, ad });
});

app.put('/api/ads/:id', (req, res) => {
    const ad = db.prepare('SELECT * FROM ads WHERE id = ?').get(req.params.id);
    if (!ad) return res.json({ success: false, message: 'الإعلان غير موجود' });

    const { title, description, priceFrom, priceTo, city, district, whatsapp, category, isActive, images, equipmentType, adType } = req.body;

    // فلتر الكلمات المحظورة (اختياري) — يفحص بس لو العنوان/الوصف تغيّروا فعلياً بهذا التعديل
    if ((title !== undefined && containsBannedWord(title)) || (description !== undefined && containsBannedWord(description))) {
        return res.json({ success: false, message: 'يحتوي التعديل على كلمات غير مسموح بها، يرجى تعديل المحتوى' });
    }

    db.prepare(`
        UPDATE ads SET
            title = ?, description = ?, price_from = ?, price_to = ?,
            city = ?, district = ?, whatsapp = ?, category = ?, ad_type = ?, is_active = ?, images = ?, equipment_type = ?,
            updated_at = datetime('now')
        WHERE id = ?
    `).run(
        title ?? ad.title,
        description ?? ad.description,
        priceFrom ?? ad.price_from,
        priceTo !== undefined ? priceTo : ad.price_to,
        city ?? ad.city,
        district ?? ad.district,
        whatsapp ?? ad.whatsapp,
        category ?? ad.category,
        adType === 'sale' || adType === 'service' ? adType : ad.ad_type,
        isActive !== undefined ? (isActive ? 1 : 0) : ad.is_active,
        images !== undefined ? JSON.stringify(images) : ad.images,
        equipmentType !== undefined ? equipmentType : ad.equipment_type,
        ad.id,
    );

    const updated = db.prepare(`${AD_JOIN_SQL} WHERE ads.id = ?`).get(ad.id);
    res.json({ success: true, ad: updated });
});

app.delete('/api/ads/:id', (req, res) => {
    db.prepare('DELETE FROM ads WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM ad_reviews WHERE ad_id = ?').run(req.params.id);
    res.json({ success: true });
});

app.post('/api/ads/:id/reviews', (req, res) => {
    const { reviewerPhone, reviewerName, rating, comment } = req.body;

    if (!reviewerPhone || !rating) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
    }

    const ratingNum = parseInt(rating, 10);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return res.json({ success: false, message: 'التقييم لازم يكون رقم من 1 إلى 5' });
    }

    const ad = db.prepare('SELECT * FROM ads WHERE id = ?').get(req.params.id);
    if (!ad) return res.json({ success: false, message: 'الإعلان غير موجود' });

    db.prepare(`
        INSERT INTO ad_reviews (ad_id, reviewer_phone, reviewer_name, rating, comment)
        VALUES (?, ?, ?, ?, ?)
    `).run(ad.id, reviewerPhone, reviewerName || null, ratingNum, comment || '');

    res.json({ success: true });
});

app.get('/api/ads/:id/reviews', (req, res) => {
    const reviews = db.prepare(`
        SELECT ad_reviews.*, (SELECT username FROM users WHERE users.phone = ad_reviews.reviewer_phone) AS reviewer_username
        FROM ad_reviews WHERE ad_id = ? ORDER BY created_at DESC
    `).all(req.params.id);
    res.json({ success: true, reviews });
});

app.post('/api/ads/:id/images', upload.array('images', 5), async (req, res) => {
    const ad = db.prepare('SELECT * FROM ads WHERE id = ?').get(req.params.id);
    if (!ad) return res.json({ success: false, message: 'الإعلان غير موجود' });

    const files = req.files || [];
    if (!files.length) return res.json({ success: false, message: 'يرجى اختيار صورة واحدة على الأقل' });

    let currentImages = [];
    try { currentImages = JSON.parse(ad.images || '[]'); } catch (e) { currentImages = []; }

    if (currentImages.length + files.length > 5) {
        return res.json({ success: false, message: `يمكن رفع 5 صور كحد أقصى — عندك ${currentImages.length} صورة بالفعل` });
    }

    // علامة مائية (شعار المنصة) لكل صورة JPG مرفوعة حديثاً — بدون أي تأثير على ملفات PDF (fileFilter يسمح بالاثنين لنفس multer instance)
    for (const f of files) {
        if (f.mimetype === 'image/jpeg') await addWatermark(f.path);
    }

    const newPaths  = files.map(f => `/uploads/${f.filename}`);
    const allImages = [...currentImages, ...newPaths];

    db.prepare("UPDATE ads SET images = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(allImages), ad.id);

    res.json({ success: true, images: allImages });
});

// ========== API رسوم معاهدة عتاد (حاسبة الرسوم والدفع) ==========

app.post('/api/fees/pay', (req, res) => {
    const { providerPhone, serviceAmount, feeAmount, paymentMethod } = req.body;

    if (!providerPhone || !serviceAmount || !feeAmount || !paymentMethod) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
    }

    const result = db.prepare(`
        INSERT INTO fee_payments (provider_phone, service_amount, fee_amount, payment_method, status)
        VALUES (?, ?, ?, ?, 'paid')
    `).run(providerPhone, serviceAmount, feeAmount, paymentMethod);

    const payment = db.prepare('SELECT * FROM fee_payments WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, payment });
});

app.get('/api/fees/:phone', (req, res) => {
    const payments = db.prepare('SELECT * FROM fee_payments WHERE provider_phone = ? ORDER BY created_at DESC').all(req.params.phone);
    res.json({ success: true, payments });
});

// كل دفعات رسوم المعاهدة من كل المعلنين (لوحة الإدارة — رسوم المعاهدة بوضع الإعلانات) — سجل ذاتي كما سجّله كل معلن بنفسه، بدون أي مفهوم "مستحق/متأخر" (المنصة ما عندها رؤية حقيقية على صفقات الإعلانات، تصير بره المنصة)
app.get('/api/fees', (req, res) => {
    const payments = db.prepare(`
        SELECT fee_payments.*,
            (SELECT name FROM users WHERE users.phone = fee_payments.provider_phone) AS provider_name,
            (SELECT username FROM users WHERE users.phone = fee_payments.provider_phone) AS provider_username
        FROM fee_payments
        ORDER BY fee_payments.created_at DESC
    `).all();
    res.json({ success: true, payments });
});

// ========== API العملات الذهبية (تصدير الإعلانات) ==========

// النشطة فقط افتراضياً (للواجهة — wallet.html)، أو الكل بـ ?includeInactive=1 (لوحة الإدارة — إدارة العملات)
app.get('/api/coins/packages', (req, res) => {
    const sql = req.query.includeInactive
        ? 'SELECT * FROM coins_packages ORDER BY total_coins ASC'
        : 'SELECT * FROM coins_packages WHERE is_active = 1 ORDER BY total_coins ASC';
    const packages = db.prepare(sql).all();
    res.json({ success: true, packages });
});

// إضافة باقة عملات جديدة (لوحة الإدارة)
app.post('/api/coins/packages', (req, res) => {
    const { name, coins, bonusCoins, price, isPopular } = req.body;
    if (!name || !coins || !price) return res.json({ success: false, message: 'بيانات ناقصة' });

    const bonus = parseInt(bonusCoins, 10) || 0;
    const total = parseInt(coins, 10) + bonus;

    const result = db.prepare(`
        INSERT INTO coins_packages (name, coins, bonus_coins, total_coins, price, is_popular)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, parseInt(coins, 10), bonus, total, parseFloat(price), isPopular ? 1 : 0);

    const pack = db.prepare('SELECT * FROM coins_packages WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, package: pack });
});

// تعديل باقة عملات موجودة (السعر/العدد/البونص/مميزة/نشطة) — لوحة الإدارة
app.put('/api/coins/packages/:id', (req, res) => {
    const pack = db.prepare('SELECT * FROM coins_packages WHERE id = ?').get(req.params.id);
    if (!pack) return res.json({ success: false, message: 'الباقة غير موجودة' });

    const name       = req.body.name ?? pack.name;
    const coins      = req.body.coins !== undefined ? parseInt(req.body.coins, 10) : pack.coins;
    const bonusCoins = req.body.bonusCoins !== undefined ? parseInt(req.body.bonusCoins, 10) : pack.bonus_coins;
    const price      = req.body.price !== undefined ? parseFloat(req.body.price) : pack.price;
    const isPopular  = req.body.isPopular !== undefined ? (req.body.isPopular ? 1 : 0) : pack.is_popular;
    const isActive   = req.body.isActive !== undefined ? (req.body.isActive ? 1 : 0) : pack.is_active;

    db.prepare(`
        UPDATE coins_packages SET name = ?, coins = ?, bonus_coins = ?, total_coins = ?, price = ?, is_popular = ?, is_active = ?
        WHERE id = ?
    `).run(name, coins, bonusCoins, coins + bonusCoins, price, isPopular, isActive, req.params.id);

    const updated = db.prepare('SELECT * FROM coins_packages WHERE id = ?').get(req.params.id);
    res.json({ success: true, package: updated });
});

// رصيد مستخدم محدد — يرجّع أصفار لو ماكو صف له بعد (ما يُنشئ صف فاضي، نفس فلسفة القراءة البسيطة المعتمدة بباقي المشروع)
app.get('/api/coins/balance/:phone', (req, res) => {
    const row = db.prepare('SELECT * FROM user_coins WHERE phone = ?').get(req.params.phone);
    res.json({
        success: true,
        balance: row ? row.balance : 0,
        totalPurchased: row ? row.total_purchased : 0,
        totalSpent: row ? row.total_spent : 0,
    });
});

// شراء باقة عملات — يضيف للرصيد ويسجّل المعاملة (ينشئ صف user_coins أول مرة لو ماكو)
app.post('/api/coins/purchase', (req, res) => {
    const { phone, packageId } = req.body;

    if (!phone || !packageId) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
    }

    const pack = db.prepare('SELECT * FROM coins_packages WHERE id = ?').get(packageId);
    if (!pack) return res.json({ success: false, message: 'الباقة غير موجودة' });

    const existing = db.prepare('SELECT * FROM user_coins WHERE phone = ?').get(phone);
    if (existing) {
        db.prepare(`
            UPDATE user_coins SET balance = balance + ?, total_purchased = total_purchased + ?, updated_at = datetime('now')
            WHERE phone = ?
        `).run(pack.total_coins, pack.total_coins, phone);
    } else {
        db.prepare(`
            INSERT INTO user_coins (phone, balance, total_purchased) VALUES (?, ?, ?)
        `).run(phone, pack.total_coins, pack.total_coins);
    }

    db.prepare(`
        INSERT INTO coins_transactions (phone, type, amount, description)
        VALUES (?, 'purchase', ?, ?)
    `).run(phone, pack.total_coins, `شراء باقة ${pack.name}${pack.bonus_coins ? ` (+${pack.bonus_coins} مجاناً)` : ''}`);

    const updated = db.prepare('SELECT * FROM user_coins WHERE phone = ?').get(phone);
    res.json({ success: true, balance: updated.balance });
});

// تصدير إعلان مقابل 10 عملات لمدة 24 ساعة
app.post('/api/coins/feature-ad', (req, res) => {
    const { phone, adId } = req.body;
    // تكلفة ومدة التصدير صارت قابلة للتعديل من لوحة الإدارة (إعدادات العملات) — جدول app_config، نفس القيم الافتراضية القديمة (10 عملات/24 ساعة) لو ماكو إعداد محفوظ لأي سبب
    const FEATURE_COST = Number(db.prepare("SELECT value FROM app_config WHERE key = 'feature_ad_coin_cost'").get()?.value) || 10;
    const FEATURE_HOURS = Number(db.prepare("SELECT value FROM app_config WHERE key = 'feature_ad_duration_hours'").get()?.value) || 24;

    if (!phone || !adId) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
    }

    const ad = db.prepare('SELECT * FROM ads WHERE id = ?').get(adId);
    if (!ad) return res.json({ success: false, message: 'الإعلان غير موجود' });

    const wallet = db.prepare('SELECT * FROM user_coins WHERE phone = ?').get(phone);
    const balance = wallet ? wallet.balance : 0;

    if (balance < FEATURE_COST) {
        return res.json({ success: false, message: 'رصيدك غير كافٍ', balance });
    }

    db.prepare(`
        UPDATE user_coins SET balance = balance - ?, total_spent = total_spent + ?, updated_at = datetime('now')
        WHERE phone = ?
    `).run(FEATURE_COST, FEATURE_COST, phone);

    db.prepare(`
        UPDATE ads SET is_featured = 1, featured_until = datetime('now', ?), featured_count = featured_count + 1
        WHERE id = ?
    `).run(`+${FEATURE_HOURS} hours`, adId);

    db.prepare(`
        INSERT INTO coins_transactions (phone, type, amount, description, ad_id)
        VALUES (?, 'spend', ?, ?, ?)
    `).run(phone, FEATURE_COST, `تصدير إعلان: ${ad.title}`, adId);

    const updatedWallet = db.prepare('SELECT * FROM user_coins WHERE phone = ?').get(phone);
    const updatedAd      = db.prepare('SELECT * FROM ads WHERE id = ?').get(adId);
    res.json({ success: true, balance: updatedWallet.balance, ad: updatedAd });
});

app.get('/api/coins/transactions/:phone', (req, res) => {
    const transactions = db.prepare('SELECT * FROM coins_transactions WHERE phone = ? ORDER BY created_at DESC').all(req.params.phone);
    res.json({ success: true, transactions });
});

// كل معاملات العملات لكل المستخدمين (لوحة الإدارة — إدارة العملات/التقارير المالية بوضع الإعلانات)
app.get('/api/coins/transactions', (req, res) => {
    const transactions = db.prepare(`
        SELECT coins_transactions.*,
            (SELECT name FROM users WHERE users.phone = coins_transactions.phone) AS user_name,
            (SELECT username FROM users WHERE users.phone = coins_transactions.phone) AS user_username
        FROM coins_transactions
        ORDER BY coins_transactions.created_at DESC
    `).all();
    res.json({ success: true, transactions });
});

// إضافة عملات هدية من الإدارة (لوحة الإدارة — إدارة الأعضاء بوضع الإعلانات) — نفس upsert pattern لـ POST /api/coins/purchase، بس نوع المعاملة bonus
app.post('/api/coins/gift', (req, res) => {
    const { phone, amount, reason } = req.body;
    const giftAmount = parseInt(amount, 10);

    if (!phone || !giftAmount || giftAmount <= 0) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
    }

    const existing = db.prepare('SELECT * FROM user_coins WHERE phone = ?').get(phone);
    if (existing) {
        db.prepare(`UPDATE user_coins SET balance = balance + ?, updated_at = datetime('now') WHERE phone = ?`).run(giftAmount, phone);
    } else {
        db.prepare('INSERT INTO user_coins (phone, balance) VALUES (?, ?)').run(phone, giftAmount);
    }

    db.prepare(`
        INSERT INTO coins_transactions (phone, type, amount, description)
        VALUES (?, 'bonus', ?, ?)
    `).run(phone, giftAmount, reason && reason.trim() ? reason.trim() : 'هدية من الإدارة');

    const updated = db.prepare('SELECT * FROM user_coins WHERE phone = ?').get(phone);
    res.json({ success: true, balance: updated.balance });
});

// يبحث عن إعلانات انتهى تصدرها ويعيدها لوضعها الطبيعي (يشتغل تلقائياً كل ساعة + متاح للاستدعاء اليدوي)
function expireFeaturedAds() {
    const result = db.prepare(`
        UPDATE ads SET is_featured = 0
        WHERE is_featured = 1 AND featured_until IS NOT NULL AND featured_until <= datetime('now')
    `).run();
    return result.changes;
}

app.post('/api/coins/expire-featured', (req, res) => {
    const expired = expireFeaturedAds();
    res.json({ success: true, expired });
});

// ========== API مفضلة الإعلانات ==========

app.post('/api/favorites', (req, res) => {
    const { phone, adId } = req.body;

    if (!phone || !adId) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
    }

    db.prepare('INSERT OR IGNORE INTO favorites (phone, ad_id) VALUES (?, ?)').run(phone, adId);
    res.json({ success: true });
});

app.delete('/api/favorites/:ad_id/:phone', (req, res) => {
    db.prepare('DELETE FROM favorites WHERE ad_id = ? AND phone = ?').run(req.params.ad_id, req.params.phone);
    res.json({ success: true });
});

// كل مفضلة مستخدم معيّن + تفاصيل الإعلان (LEFT JOIN — لو الإعلان الأصلي انحذف، ad_exists ترجع 0 وباقي حقول الإعلان فاضية)
app.get('/api/favorites/:phone', (req, res) => {
    const favorites = db.prepare(`
        SELECT
            favorites.id AS favorite_id,
            favorites.ad_id,
            favorites.created_at AS favorited_at,
            (ads.id IS NOT NULL) AS ad_exists,
            ads.id, ads.provider_phone, ads.provider_name, ads.category, ads.ad_type, ads.title, ads.description,
            ads.price_from, ads.price_to, ads.city, ads.district, ads.whatsapp, ads.images,
            ads.is_active, ads.views_count, ads.is_featured, ads.featured_until,
            (SELECT ROUND(AVG(rating), 1) FROM ad_reviews WHERE ad_reviews.ad_id = ads.id) AS avg_rating,
            (SELECT COUNT(*) FROM ad_reviews WHERE ad_reviews.ad_id = ads.id) AS reviews_count,
            (SELECT is_verified FROM users WHERE users.phone = ads.provider_phone) AS provider_is_verified
        FROM favorites
        LEFT JOIN ads ON ads.id = favorites.ad_id
        WHERE favorites.phone = ?
        ORDER BY favorites.created_at DESC
    `).all(req.params.phone);

    res.json({ success: true, favorites });
});

app.get('/api/favorites/check/:ad_id/:phone', (req, res) => {
    const row = db.prepare('SELECT id FROM favorites WHERE ad_id = ? AND phone = ?').get(req.params.ad_id, req.params.phone);
    res.json({ success: true, isFavorited: !!row });
});

// ========== API تعليقات الإعلانات ==========

app.post('/api/comments', (req, res) => {
    const { adId, commenterPhone, commenterName, comment } = req.body;

    if (!adId || !commenterPhone || !comment || !comment.trim()) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
    }

    const ad = db.prepare('SELECT * FROM ads WHERE id = ?').get(adId);
    if (!ad) return res.json({ success: false, message: 'الإعلان غير موجود' });

    // فلتر الكلمات المحظورة (اختياري)
    if (containsBannedWord(comment)) {
        return res.json({ success: false, message: 'يحتوي تعليقك على كلمات غير مسموح بها' });
    }

    const result = db.prepare(`
        INSERT INTO comments (ad_id, commenter_phone, commenter_name, comment)
        VALUES (?, ?, ?, ?)
    `).run(adId, commenterPhone, commenterName || null, comment.trim());

    // إشعار للمعلن (لو المعلّق مو نفس صاحب الإعلان)
    if (ad.provider_phone && ad.provider_phone !== commenterPhone) {
        const excerpt = comment.trim().length > 50 ? comment.trim().slice(0, 50) + '...' : comment.trim();
        createNotification(
            'تعليق جديد على إعلانك 💬',
            `${commenterName || 'مستخدم'} علّق على إعلانك "${ad.title}": ${excerpt}`,
            'update', 'specific', ad.provider_phone, ad.provider_phone
        );
    }

    const newComment = db.prepare('SELECT * FROM comments WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, comment: newComment });
});

// كل التعليقات على كل الإعلانات (لوحة الإدارة — إدارة التعليقات بوضع الإعلانات) — نفس اصطلاح includeHidden
app.get('/api/comments', (req, res) => {
    const extraSelect = `
        (SELECT username FROM users WHERE users.phone = comments.commenter_phone) AS commenter_username,
        ads.title AS ad_title, ads.category AS ad_category
    `;
    const sql = req.query.includeHidden
        ? `SELECT comments.*, ${extraSelect} FROM comments LEFT JOIN ads ON ads.id = comments.ad_id ORDER BY comments.created_at DESC`
        : `SELECT comments.*, ${extraSelect} FROM comments LEFT JOIN ads ON ads.id = comments.ad_id WHERE comments.is_visible = 1 ORDER BY comments.created_at DESC`;

    const comments = db.prepare(sql).all();
    res.json({ success: true, comments });
});

// تعليقات إعلان معيّن — الظاهرة فقط افتراضياً، أو الكل لو includeHidden=1 (لوحة الإدارة)
app.get('/api/comments/:ad_id', (req, res) => {
    const extraSelect = `
        (SELECT username FROM users WHERE users.phone = comments.commenter_phone) AS commenter_username,
        (SELECT is_verified FROM users WHERE users.phone = comments.commenter_phone) AS commenter_is_verified
    `;
    const sql = req.query.includeHidden
        ? `SELECT comments.*, ${extraSelect} FROM comments WHERE ad_id = ? ORDER BY created_at ASC`
        : `SELECT comments.*, ${extraSelect} FROM comments WHERE ad_id = ? AND is_visible = 1 ORDER BY created_at ASC`;

    const comments = db.prepare(sql).all(req.params.ad_id);
    res.json({ success: true, comments });
});

app.delete('/api/comments/:id', (req, res) => {
    db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// إخفاء/إظهار تعليق (لوحة الإدارة) — body اختياري { isVisible }، افتراضياً يخفي
app.put('/api/comments/:id/hide', (req, res) => {
    const isVisible = req.body && req.body.isVisible !== undefined ? (req.body.isVisible ? 1 : 0) : 0;
    db.prepare('UPDATE comments SET is_visible = ? WHERE id = ?').run(isVisible, req.params.id);
    res.json({ success: true });
});

// ========== API الرسائل الداخلية (مرتبطة بالإعلانات) ==========

// إنشاء محادثة جديدة — لو فيه محادثة موجودة أصلاً لنفس الإعلان بين نفس الطرفين (بأي اتجاه) يرجّعها بدل تكرارها
app.post('/api/conversations', (req, res) => {
    const { adId, user1Phone, user2Phone } = req.body;

    if (!adId || !user1Phone || !user2Phone) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
    }

    if (user1Phone === user2Phone) {
        return res.json({ success: false, message: 'لا يمكنك مراسلة نفسك' });
    }

    const existing = db.prepare(`
        SELECT * FROM conversations
        WHERE ad_id = ? AND (
            (user1_phone = ? AND user2_phone = ?) OR
            (user1_phone = ? AND user2_phone = ?)
        )
    `).get(adId, user1Phone, user2Phone, user2Phone, user1Phone);

    if (existing) {
        return res.json({ success: true, conversation: existing });
    }

    const ad = db.prepare('SELECT title FROM ads WHERE id = ?').get(adId);

    const result = db.prepare(`
        INSERT INTO conversations (ad_id, ad_title, user1_phone, user2_phone)
        VALUES (?, ?, ?, ?)
    `).run(adId, ad ? ad.title : null, user1Phone, user2Phone);

    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, conversation });
});

// كل محادثات مستخدم معيّن، الأحدث أولاً — مع اسم الطرف الآخر وعدد غير المقروء الفعلي لهذا المستخدم تحديداً
// (unread_count بجدول conversations عمود تذكاري بس، مو مصدر موثوق — كل محادثة طرفين قد يختلف عددهم غير المقروء، فنحسبه حياً من جدول messages)
app.get('/api/conversations/:phone', (req, res) => {
    const phone = req.params.phone;

    const conversations = db.prepare(`
        SELECT c.*,
            CASE WHEN c.user1_phone = ? THEN c.user2_phone ELSE c.user1_phone END AS other_phone,
            (SELECT name FROM users WHERE phone = CASE WHEN c.user1_phone = ? THEN c.user2_phone ELSE c.user1_phone END) AS other_name,
            (SELECT is_verified FROM users WHERE phone = CASE WHEN c.user1_phone = ? THEN c.user2_phone ELSE c.user1_phone END) AS other_is_verified,
            (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND receiver_phone = ? AND is_read = 0) AS my_unread_count
        FROM conversations c
        WHERE c.user1_phone = ? OR c.user2_phone = ?
        ORDER BY c.last_message_at DESC, c.created_at DESC
    `).all(phone, phone, phone, phone, phone, phone);

    res.json({ success: true, conversations });
});

// رسائل محادثة معيّنة، مرتبة زمنياً
app.get('/api/messages/:conversationId', (req, res) => {
    const messages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(req.params.conversationId);
    res.json({ success: true, messages });
});

// إرسال رسالة جديدة — المستقبل يُحدَّد من طرفي المحادثة بالسيرفر (مو من المرسل)، يحدّث آخر رسالة بالمحادثة، ويرسل إشعار حقيقي للمستقبل
app.post('/api/messages', (req, res) => {
    const { conversationId, senderPhone, message } = req.body;

    if (!conversationId || !senderPhone || !message || !message.trim()) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
    }

    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
    if (!conversation) {
        return res.json({ success: false, message: 'المحادثة غير موجودة' });
    }

    const receiverPhone = conversation.user1_phone === senderPhone ? conversation.user2_phone : conversation.user1_phone;

    const result = db.prepare(`
        INSERT INTO messages (conversation_id, ad_id, sender_phone, receiver_phone, message)
        VALUES (?, ?, ?, ?, ?)
    `).run(conversationId, conversation.ad_id, senderPhone, receiverPhone, message.trim());

    db.prepare(`UPDATE conversations SET last_message = ?, last_message_at = datetime('now') WHERE id = ?`)
        .run(message.trim(), conversationId);

    const sender     = db.prepare('SELECT name FROM users WHERE phone = ?').get(senderPhone);
    const senderName = (sender && sender.name) ? sender.name : `+966${senderPhone}`;

    createNotification(
        'رسالة جديدة 💬',
        `${senderName} أرسل لك رسالة عن إعلانك: ${conversation.ad_title || ''}`,
        'update', 'specific', receiverPhone, receiverPhone
    );

    const sentMessage = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, sentMessage });
});

// تعليم رسائل محادثة كمقروءة — فقط الرسائل الموجّهة لهذا الهاتف تحديداً (مو كل رسائل المحادثة)
app.put('/api/messages/:conversationId/read', (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.json({ success: false, message: 'بيانات ناقصة' });

    db.prepare('UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND receiver_phone = ?')
        .run(req.params.conversationId, phone);

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
        ads.title AS ad_title, ads.category AS ad_category,
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
    LEFT JOIN ads ON ads.id = complaints.ad_id
`;

// قراءة فقط (بدون أي إجراء) — تبقى لعرض تفاصيل طلب/محادثة قديمة مرتبطة بشكوى قديمة بلوحة الإدارة بعد إزالة النظام المدفوع بالكامل
app.get('/api/orders/:id', (req, res) => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.json({ success: false, message: 'الطلب غير موجود' });
    res.json({ success: true, order });
});

app.get('/api/chats/:orderId', (req, res) => {
    const messages = db.prepare(
        'SELECT * FROM chats WHERE order_id = ? ORDER BY created_at ASC, id ASC'
    ).all(req.params.orderId);
    res.json({ success: true, messages });
});

app.post('/api/complaints', (req, res) => {
    const { orderId, adId, reporterPhone, reporterType, reportedPhone, reportedType, type, description } = req.body;

    if (!reporterPhone || !reporterType || !type) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
    }

    const result = db.prepare(`
        INSERT INTO complaints (order_id, ad_id, reporter_phone, reporter_type, reported_phone, reported_type, type, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(orderId || null, adId || null, reporterPhone, reporterType, reportedPhone || null, reportedType || null, type, description || '');

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
            'تنبيه من إدارة عتاد',
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

// معالج أخطاء عام — أخطاء رفع الملفات (نوع غير مسموح، حجم كبير) لها رسالة مخصصة، وأي خطأ آخر غير متوقع يُسجَّل بالطرفية ويرجع رسالة عامة (بدل ما ينكسر الاتصال بصمت)
app.use((err, req, res, next) => {
    if (!err) return next();

    if (err instanceof multer.MulterError || err.message === 'نوع ملف غير مسموح — يُقبل PDF أو JPG فقط') {
        return res.json({ success: false, message: 'تعذّر رفع الملف — يُقبل PDF أو JPG فقط، وبحجم أقل من 5MB' });
    }

    console.error('❌ خطأ غير متوقع بالسيرفر:', err);
    res.status(500).json({ success: false, message: 'حدث خطأ غير متوقع بالسيرفر' });
});

// صفحة 404
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '404.html'));
});

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

// ========== فحص دوري: انتهاء تصدّر الإعلانات (24 ساعة) ==========
setInterval(expireFeaturedAds, 60 * 60 * 1000);

// ========== تشغيل السيرفر ==========
app.listen(PORT, () => {
    console.log(`
🚀 سيرفر عتاد شغال!
🌐 افتح المتصفح على: http://localhost:${PORT}
📡 API جاهز على: http://localhost:${PORT}/api
    `);
});