// سيرفر يشجب — مع قاعدة البيانات

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const db      = require('./database');

const app  = express();
const PORT = 3000;

// إعدادات السيرفر
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ========== API المستخدمين ==========

// إرسال OTP
app.post('/api/auth/send-otp', (req, res) => {
    const { phone } = req.body;

    if (!phone || phone.length !== 9) {
        return res.json({ success: false, message: 'رقم الجوال غير صحيح' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // حفظ في قاعدة البيانات
    const existing = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);

    if (existing) {
        db.prepare('UPDATE users SET otp = ? WHERE phone = ?').run(otp, phone);
    } else {
        db.prepare('INSERT INTO users (phone, otp) VALUES (?, ?)').run(phone, otp);
    }

    console.log(`📱 OTP للرقم ${phone}: ${otp}`);

    res.json({ success: true, message: 'تم إرسال الرمز', otp });
});

// التحقق من OTP
app.post('/api/auth/verify-otp', (req, res) => {
    const { phone, otp } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);

    if (!user || user.otp !== otp) {
        return res.json({ success: false, message: 'رمز التحقق غير صحيح' });
    }

    db.prepare('UPDATE users SET verified = 1 WHERE phone = ?').run(phone);

    res.json({ success: true, message: 'تم تسجيل الدخول بنجاح', phone });
});

// ========== API الطلبات ==========

// إنشاء طلب جديد
app.post('/api/orders', (req, res) => {
    const { phone, service, address, price } = req.body;

    if (!phone || !service || !address) {
        return res.json({ success: false, message: 'بيانات ناقصة' });
    }

    const commission = Math.round(price * 0.07);

    const result = db.prepare(`
        INSERT INTO orders (phone, service, address, price, commission)
        VALUES (?, ?, ?, ?, ?)
    `).run(phone, service, address, price, commission);

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);

    console.log(`✅ طلب جديد #${order.id} — ${service} — ${address}`);

    res.json({ success: true, order });
});

// جلب كل الطلبات
app.get('/api/orders', (req, res) => {
    const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    res.json({ success: true, orders });
});

// جلب طلب محدد
app.get('/api/orders/:id', (req, res) => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);

    if (!order) {
        return res.json({ success: false, message: 'الطلب غير موجود' });
    }

    res.json({ success: true, order });
});

// تحديث حالة الطلب
app.put('/api/orders/:id/status', (req, res) => {
    const { status } = req.body;

    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);

    res.json({ success: true, order });
});

// جلب كل المستخدمين
app.get('/api/users', (req, res) => {
    const users = db.prepare('SELECT id, phone, verified, created_at FROM users').all();
    res.json({ success: true, users });
});

// ========== تشغيل السيرفر ==========
app.listen(PORT, () => {
    console.log(`
🚀 سيرفر يشجب شغال!
🌐 افتح المتصفح على: http://localhost:${PORT}
📡 API جاهز على: http://localhost:${PORT}/api
    `);
});