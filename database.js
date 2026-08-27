// قاعدة بيانات يشجب

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

`);

// زرع المدن الأساسية أول مرة بس (لو الجدول فاضي)
const cityCount = db.prepare('SELECT COUNT(*) AS n FROM cities').get().n;
if (cityCount === 0) {
    const insertCity = db.prepare('INSERT INTO cities (name) VALUES (?)');
    ['الرياض', 'جدة', 'الدمام', 'مكة', 'المدينة المنورة'].forEach(name => insertCity.run(name));
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