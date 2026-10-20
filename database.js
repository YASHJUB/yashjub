// قاعدة بيانات غَوْث

const Database = require('better-sqlite3');
const db = new Database('yashjub.db');

// إنشاء الجداول
db.exec(`

    -- جدول المستخدمين
    CREATE TABLE IF NOT EXISTS users (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        phone      TEXT UNIQUE NOT NULL,
        otp        TEXT,
        verified   INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
    );

    -- جدول الطلبات
    CREATE TABLE IF NOT EXISTS orders (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        phone      TEXT NOT NULL,
        service    TEXT NOT NULL,
        address    TEXT NOT NULL,
        price      INTEGER NOT NULL,
        commission INTEGER NOT NULL,
        status     TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now'))
    );

    -- جدول المزودين
    CREATE TABLE IF NOT EXISTS providers (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        phone        TEXT UNIQUE NOT NULL,
        name         TEXT NOT NULL,
        service_type TEXT NOT NULL,
        level        TEXT DEFAULT 'basic',
        is_available INTEGER DEFAULT 1,
        rating       REAL DEFAULT 5.0,
        created_at   TEXT DEFAULT (datetime('now'))
    );

    -- جدول منتجات مزودي الحاوية
    CREATE TABLE IF NOT EXISTS products (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id  INTEGER NOT NULL,
        name         TEXT NOT NULL,
        description  TEXT,
        size         TEXT NOT NULL,
        price        INTEGER NOT NULL,
        city         TEXT NOT NULL,
        neighborhood TEXT NOT NULL,
        is_available INTEGER DEFAULT 1,
        created_at   TEXT DEFAULT (datetime('now'))
    );

    -- جدول موظفي لوحة الإدارة
    CREATE TABLE IF NOT EXISTS employees (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        phone      TEXT NOT NULL,
        iban       TEXT,
        role       TEXT NOT NULL,
        username   TEXT UNIQUE NOT NULL,
        password   TEXT NOT NULL,
        is_active  INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
    );

    -- جدول المدن المتاحة بالمنصة
    CREATE TABLE IF NOT EXISTS cities (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT UNIQUE NOT NULL,
        is_active  INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
    );

    -- جدول كوبونات الخصم
    CREATE TABLE IF NOT EXISTS coupons (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        code           TEXT UNIQUE NOT NULL,
        discount_type  TEXT NOT NULL DEFAULT 'percent',
        discount_value REAL NOT NULL,
        max_discount   REAL,
        usage_limit    INTEGER,
        used_count     INTEGER DEFAULT 0,
        expires_at     TEXT,
        is_active      INTEGER DEFAULT 1,
        created_at     TEXT DEFAULT (datetime('now'))
    );

    -- جدول كتالوج الخدمات (يغذي قائمة الخدمات بالصفحة الرئيسية)
    CREATE TABLE IF NOT EXISTS services (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT UNIQUE NOT NULL,
        icon          TEXT NOT NULL,
        description   TEXT,
        badge_type    TEXT NOT NULL DEFAULT 'instant',
        action_type   TEXT NOT NULL DEFAULT 'order',
        min_price     INTEGER,
        time_estimate TEXT,
        is_active     INTEGER DEFAULT 1,
        sort_order    INTEGER DEFAULT 0,
        created_at    TEXT DEFAULT (datetime('now'))
    );

    -- جدول محادثات الطلبات (عميل/مزوّد/إدارة)
    CREATE TABLE IF NOT EXISTS chats (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id     INTEGER NOT NULL,
        sender       TEXT NOT NULL,
        sender_phone TEXT,
        message      TEXT NOT NULL,
        is_read      INTEGER DEFAULT 0,
        created_at   TEXT DEFAULT (datetime('now'))
    );

    -- جدول الإشعارات
    CREATE TABLE IF NOT EXISTS notifications (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        title          TEXT NOT NULL,
        message        TEXT NOT NULL,
        type           TEXT NOT NULL DEFAULT 'update',
        target         TEXT NOT NULL DEFAULT 'specific',
        target_phone   TEXT,
        receiver_phone TEXT NOT NULL,
        is_read        INTEGER DEFAULT 0,
        created_at     TEXT DEFAULT (datetime('now'))
    );

    -- جدول البلاغات والشكاوى
    CREATE TABLE IF NOT EXISTS complaints (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id       INTEGER,
        reporter_phone TEXT NOT NULL,
        reporter_type  TEXT NOT NULL,
        reported_phone TEXT,
        reported_type  TEXT,
        type           TEXT NOT NULL,
        description    TEXT,
        status         TEXT NOT NULL DEFAULT 'new',
        admin_note     TEXT,
        action_taken   TEXT,
        created_at     TEXT DEFAULT (datetime('now')),
        resolved_at    TEXT
    );

    -- جدول التقييمات
    CREATE TABLE IF NOT EXISTS reviews (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id       INTEGER,
        reviewer_phone TEXT NOT NULL,
        reviewer_type  TEXT NOT NULL,
        reviewed_phone TEXT NOT NULL,
        reviewed_type  TEXT NOT NULL,
        rating         INTEGER NOT NULL,
        comment        TEXT,
        admin_reply    TEXT,
        is_visible     INTEGER DEFAULT 1,
        is_flagged     INTEGER DEFAULT 0,
        created_at     TEXT DEFAULT (datetime('now'))
    );

    -- جدول شهادات العملاء (تسويقية، تظهر بالصفحة الرئيسية بعد موافقة الإدارة)
    CREATE TABLE IF NOT EXISTS testimonials (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        client_phone TEXT NOT NULL,
        client_name  TEXT NOT NULL,
        rating       INTEGER NOT NULL,
        comment      TEXT NOT NULL,
        service      TEXT,
        status       TEXT NOT NULL DEFAULT 'pending',
        created_at   TEXT DEFAULT (datetime('now'))
    );

    -- جدول الفواتير (تُنشأ تلقائياً عند اكتمال الطلب)
    CREATE TABLE IF NOT EXISTS invoices (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE NOT NULL,
        order_id       INTEGER UNIQUE NOT NULL,
        client_phone   TEXT NOT NULL,
        client_name    TEXT,
        service        TEXT NOT NULL,
        address        TEXT,
        price          INTEGER NOT NULL,
        commission     INTEGER NOT NULL,
        total          INTEGER NOT NULL,
        payment_method TEXT DEFAULT 'دفع إلكتروني',
        payment_status TEXT NOT NULL DEFAULT 'paid',
        created_at     TEXT DEFAULT (datetime('now'))
    );

    -- جدول إعدادات النظام العامة (تفعيل/تعطيل أنظمة المنصة — قسم "النظام والسياسات" بلوحة الإدارة)
    CREATE TABLE IF NOT EXISTS system_settings (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        key        TEXT UNIQUE NOT NULL,
        value      TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
    );

    -- جدول إعلانات "منصة غوث معاهدة" (نظام بديل مجاني — إعلان واحد فقط لكل مزود بكل قسم)
    CREATE TABLE IF NOT EXISTS ads (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_phone TEXT NOT NULL,
        provider_name  TEXT,
        category       TEXT NOT NULL,
        title          TEXT NOT NULL,
        description    TEXT,
        price_from     INTEGER NOT NULL,
        price_to       INTEGER,
        city           TEXT NOT NULL,
        district       TEXT,
        whatsapp       TEXT NOT NULL,
        images         TEXT DEFAULT '[]',
        is_active      INTEGER DEFAULT 1,
        views_count    INTEGER DEFAULT 0,
        created_at     TEXT DEFAULT (datetime('now')),
        updated_at     TEXT DEFAULT (datetime('now')),
        UNIQUE(provider_phone, category)
    );

    -- جدول تقييمات الإعلانات
    CREATE TABLE IF NOT EXISTS ad_reviews (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        ad_id          INTEGER NOT NULL,
        reviewer_phone TEXT NOT NULL,
        reviewer_name  TEXT,
        rating         INTEGER NOT NULL,
        comment        TEXT,
        created_at     TEXT DEFAULT (datetime('now'))
    );

    -- جدول دفعات رسوم معاهدة غوث (1% من قيمة الخدمة، تُدفع يدوياً من المزوّد عبر حاسبة الرسوم)
    CREATE TABLE IF NOT EXISTS fee_payments (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_phone TEXT NOT NULL,
        service_amount REAL NOT NULL,
        fee_amount     REAL NOT NULL,
        payment_method TEXT NOT NULL,
        status         TEXT NOT NULL DEFAULT 'paid',
        created_at     TEXT DEFAULT (datetime('now'))
    );

    -- جدول محادثات الرسائل الداخلية المرتبطة بالإعلانات (محادثة واحدة لكل زوج عميل/معلن على نفس الإعلان)
    CREATE TABLE IF NOT EXISTS conversations (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        ad_id           INTEGER NOT NULL,
        ad_title        TEXT,
        user1_phone     TEXT NOT NULL,
        user2_phone     TEXT NOT NULL,
        last_message    TEXT,
        last_message_at TEXT,
        unread_count    INTEGER DEFAULT 0,
        created_at      TEXT DEFAULT (datetime('now'))
    );

    -- جدول رسائل المحادثات
    CREATE TABLE IF NOT EXISTS messages (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        ad_id           INTEGER,
        sender_phone    TEXT NOT NULL,
        receiver_phone  TEXT NOT NULL,
        message         TEXT NOT NULL,
        is_read         INTEGER DEFAULT 0,
        created_at      TEXT DEFAULT (datetime('now'))
    );

    -- جدول باقات العملات الذهبية (تصدير الإعلانات)
    CREATE TABLE IF NOT EXISTS coins_packages (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL,
        coins       INTEGER NOT NULL,
        bonus_coins INTEGER DEFAULT 0,
        total_coins INTEGER NOT NULL,
        price       REAL NOT NULL,
        is_popular  INTEGER DEFAULT 0,
        created_at  TEXT DEFAULT (datetime('now'))
    );

    -- جدول رصيد العملات الذهبية لكل مستخدم
    CREATE TABLE IF NOT EXISTS user_coins (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        phone           TEXT UNIQUE NOT NULL,
        balance         INTEGER DEFAULT 0,
        total_purchased INTEGER DEFAULT 0,
        total_spent     INTEGER DEFAULT 0,
        updated_at      TEXT DEFAULT (datetime('now'))
    );

    -- جدول سجل معاملات العملات الذهبية
    CREATE TABLE IF NOT EXISTS coins_transactions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        phone       TEXT NOT NULL,
        type        TEXT NOT NULL,
        amount      INTEGER NOT NULL,
        description TEXT,
        ad_id       INTEGER,
        created_at  TEXT DEFAULT (datetime('now'))
    );

    -- جدول مفضلة الإعلانات
    CREATE TABLE IF NOT EXISTS favorites (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        phone      TEXT NOT NULL,
        ad_id      INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(phone, ad_id)
    );

`);

// زرع المدن الأساسية أول مرة بس (لو الجدول فاضي)
const cityCount = db.prepare('SELECT COUNT(*) AS n FROM cities').get().n;
if (cityCount === 0) {
    const insertCity = db.prepare('INSERT INTO cities (name) VALUES (?)');
    ['الرياض', 'جدة', 'الدمام', 'مكة', 'المدينة المنورة'].forEach(name => insertCity.run(name));
}

// زرع الخدمات الأساسية الأربع أول مرة بس (لو الجدول فاضي) — نفس البيانات اللي كانت مكتوبة بالكود سابقاً
const serviceCount = db.prepare('SELECT COUNT(*) AS n FROM services').get().n;
if (serviceCount === 0) {
    const insertService = db.prepare(`
        INSERT INTO services (name, icon, description, badge_type, action_type, min_price, time_estimate, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertService.run('وايت ماء', 'truck', 'توصيل المياه لمواقع البناء', 'instant', 'order', 150, '8 دقائق', 1);
    insertService.run('سطحة', 'tow-truck', 'نقل وسحب المركبات', 'instant', 'order', 100, '12 دقيقة', 2);
    insertService.run('حاوية', 'box', 'حاويات البناء والنفايات', 'scheduled', 'container', null, 'غداً 11 صباحاً', 3);
    insertService.run('معدات ثقيلة', 'crane', 'بوكلينات، شيولات، قلابات، رافعات', 'coming', 'panel', null, null, 4);
}

// زرع إعدادات النظام الافتراضية أول مرة بس (لو الجدول فاضي)
const settingsCount = db.prepare('SELECT COUNT(*) AS n FROM system_settings').get().n;
if (settingsCount === 0) {
    const insertSetting = db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?)');
    insertSetting.run('paid_system', 'true');
    insertSetting.run('ads_system', 'false');
}

// زرع باقات العملات الذهبية الافتراضية أول مرة بس (لو الجدول فاضي)
const coinsPackageCount = db.prepare('SELECT COUNT(*) AS n FROM coins_packages').get().n;
if (coinsPackageCount === 0) {
    const insertPackage = db.prepare(`
        INSERT INTO coins_packages (name, coins, bonus_coins, total_coins, price, is_popular)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertPackage.run('30 عملة',  30,  0,   30,   17.99,  0);
    insertPackage.run('59 عملة',  59,  9,   68,   34.99,  0);
    insertPackage.run('109 عملة', 109, 33,  142,  64.99,  1);
    insertPackage.run('274 عملة', 274, 90,  364,  159.99, 0);
    insertPackage.run('824 عملة', 824, 280, 1104, 479.99, 0);
}

// ترقية الجداول القديمة (migrations بسيطة — تتجاهل الخطأ لو العمود موجود مسبقاً)
const migrations = [
    'ALTER TABLE providers ADD COLUMN city TEXT',
    'ALTER TABLE providers ADD COLUMN price_small INTEGER',
    'ALTER TABLE providers ADD COLUMN price_medium INTEGER',
    'ALTER TABLE providers ADD COLUMN price_large INTEGER',
    'ALTER TABLE orders ADD COLUMN provider_id INTEGER',
    'ALTER TABLE orders ADD COLUMN provider_name TEXT',
    'ALTER TABLE orders ADD COLUMN product_id INTEGER',
    'ALTER TABLE products ADD COLUMN min_days INTEGER DEFAULT 10',
    'ALTER TABLE providers ADD COLUMN id_document_path TEXT',
    'ALTER TABLE providers ADD COLUMN certificate_path TEXT',
    'ALTER TABLE orders ADD COLUMN provider_phone TEXT',
    'ALTER TABLE orders ADD COLUMN lat REAL',
    'ALTER TABLE orders ADD COLUMN lng REAL',
    'ALTER TABLE products ADD COLUMN lat REAL',
    'ALTER TABLE products ADD COLUMN lng REAL',
    'ALTER TABLE users ADD COLUMN name TEXT',
    'ALTER TABLE orders ADD COLUMN coupon_code TEXT',
    'ALTER TABLE orders ADD COLUMN discount INTEGER DEFAULT 0',
    'ALTER TABLE orders ADD COLUMN accepted_at TEXT',
    'ALTER TABLE providers ADD COLUMN suspended_until TEXT',
    'ALTER TABLE users ADD COLUMN suspended_until TEXT',
    "ALTER TABLE providers ADD COLUMN status TEXT DEFAULT 'approved'",
    'ALTER TABLE providers ADD COLUMN work_lat REAL',
    'ALTER TABLE providers ADD COLUMN work_lng REAL',
    'ALTER TABLE providers ADD COLUMN work_radius REAL',
    'ALTER TABLE providers ADD COLUMN work_city TEXT',
    'ALTER TABLE providers ADD COLUMN driving_license_path TEXT',
    'ALTER TABLE providers ADD COLUMN vehicle_registration_path TEXT',
    'ALTER TABLE providers ADD COLUMN transport_permit_path TEXT',
    'ALTER TABLE orders ADD COLUMN arrived_at TEXT',
    'ALTER TABLE orders ADD COLUMN completed_at TEXT',
    'ALTER TABLE orders ADD COLUMN provider_lat REAL',
    'ALTER TABLE orders ADD COLUMN provider_lng REAL',
    'ALTER TABLE orders ADD COLUMN completion_requested_at TEXT',
    'ALTER TABLE orders ADD COLUMN client_confirmed INTEGER',
    'ALTER TABLE orders ADD COLUMN client_confirmed_at TEXT',
    'ALTER TABLE orders ADD COLUMN dispute_reason TEXT',
    'ALTER TABLE orders ADD COLUMN auto_released INTEGER DEFAULT 0',
    'ALTER TABLE ads ADD COLUMN accepted_covenant INTEGER DEFAULT 0',
    'ALTER TABLE ads ADD COLUMN covenant_accepted_at TEXT',
    'ALTER TABLE users ADD COLUMN email TEXT',
    'ALTER TABLE ads ADD COLUMN is_featured INTEGER DEFAULT 0',
    'ALTER TABLE ads ADD COLUMN featured_until TEXT',
    'ALTER TABLE ads ADD COLUMN featured_count INTEGER DEFAULT 0',
];

for (const sql of migrations) {
    try {
        db.exec(sql);
    } catch (err) {
        // العمود موجود مسبقاً — تجاهل
    }
}

console.log('✅ قاعدة البيانات جاهزة!');

module.exports = db;