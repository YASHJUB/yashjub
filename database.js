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

`);

console.log('✅ قاعدة البيانات جاهزة!');

module.exports = db;