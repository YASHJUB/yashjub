# مشروع يشجب (YASHJUB)

منصة رقمية سعودية تربط العملاء بمزودي خدمات البناء والبنية التحتية. تعمل على نظام مشابه لـ Uber (طلب فوري) + منصات الحجز (جدولة مسبقة).

- **الرابط الحالي:** `https://yashjub-production.up.railway.app`
- **GitHub:** `https://github.com/YASHJUB/yashjub`
- **الاستضافة:** Railway — يتحدّث تلقائياً عند كل `git push`

## الخدمات المتاحة

| الخدمة | النوع | السعر |
|---|---|---|
| فان تاي واي 🚚 | فوري | 200 ريال |
| سطحة 🚛 | فوري | 250 ريال |
| حاوية 📦 | مجدول | 150–400 ريال/يوم (حد أدنى 10 أيام) |
| معدات ثقيلة 🏗️ | مرحباً | — |

- الحاوية: صغيرة (3م) 150، متوسطة (6م) 250، كبيرة (12م) 400 ريال/يوم، حد أدنى 10 أيام
- السطحة: تحتاج موقعين — موقع السيارة الحالي + موقع التوصيل

## نظام المالية

- رسوم الخدمة: 5% من قيمة كل طلب، تُخصم تلقائياً
- نظام الدفع: Escrow (أمانة) — يُحفظ حتى اكتمال الخدمة
- لا يوجد اشتراك شهري في المرحلة الأولى

## أنواع المستخدمين

**العميل:** تسجيل دخول برقم الجوال + OTP، يطلب الخدمات، يتتبع الطلب، يقيّم المزوّد بعد الاكتمال.

**المزوّد (3 مستويات):**
| المستوى | المتطلبات | المميزات |
|---|---|---|
| أساسي | هوية + جوال + IBAN | ظهور محدود |
| موثّق | + شهادة العمل الحر | ظهور أعلى + شارة توثيق |
| شركة | + سجل تجاري | ظهور كامل + أولوية |

**المدير (Admin):** `admin` / `yashjub2025` — رابط `/admin.html`

## هيكل الملفات

```
yashjub/
├── index.html / app.js              الصفحة الرئيسية
├── login.html / login.js            تسجيل الدخول
├── order.html / order.js            صفحة الطلب
├── tracking.html / tracking.js      تتبع الطلب
├── my-orders.html / my-orders.js    طلباتي
├── provider.html / provider.js      لوحة المزوّد
├── register-provider.html / .js     تسجيل مزوّد جديد
├── profile.html / profile.js        الملف الشخصي
├── admin.html / admin.js            لوحة الإدارة
├── about.html, contact.html, terms.html, 404.html
├── server.js                        السيرفر الرئيسي (Express)
├── database.js                      إعداد قاعدة البيانات
├── style.css                        التصميم الكامل
├── yashjub.db                       قاعدة بيانات SQLite (مستثناة من git)
└── images/                          logo.png, banner.jpeg
```

## التقنيات

**Frontend:** HTML5, CSS3, JavaScript (Vanilla) — خط Cairo من Google Fonts — RTL دائماً (عربي أولاً) — Responsive (جوال أولاً)

**Backend:** Node.js + Express.js, better-sqlite3, CORS + dotenv

**قاعدة البيانات (SQLite):**
```sql
users       -- phone, otp, verified
orders      -- phone, service, address, price, commission, status
providers   -- phone, name, service_type, level, rating
```

**API Endpoints:**
```
POST /api/auth/send-otp
POST /api/auth/verify-otp
POST /api/orders
GET  /api/orders
GET  /api/orders/:id
GET  /api/orders/user/:phone
PUT  /api/orders/:id/status
GET  /api/users
POST /api/providers/register
GET  /api/providers
```

## هوية التصميم

```css
--black:  #111111  /* الأسود الرئيسي */
--yellow: #F5C518  /* الأصفر الذهبي */
--white:  #FFFFFF
--gray:   #FAFAFA  /* رمادي فاتح */
--green:  #10B981  /* عمليات ناجحة */
--red:    #EF4444  /* أخطاء وإلغاء */
```

مبادئ التصميم: Arabic First (RTL دائماً) — Mobile First — Minimal (بسيط ونظيف) — خط Cairo للنصوص العربية — بطاقات بزوايا مستديرة (`border-radius: 16px`) — ظل خفيف على البطاقات — بلا gradients، ألوان ثابتة فقط.

مكوّنات متكررة: `.service-row`, `.btn`, `.btn-small`, `.header`, `.footer`, `.app-sidebar`, `.how-card`

## ملاحظات مهمة للمطوّر

1. السيرفر دائماً على port 3000
2. قاعدة البيانات `yashjub.db` في نفس المجلد
3. كلمة مرور الإدارة: `yashjub2025`
4. OTP الحالي محاكاة فقط — يظهر في alert (لم يُربط بمزود SMS حقيقي بعد)
5. العمولة 5% تُخصم تلقائياً
6. localStorage يحفظ `yashjub_phone` و `yashjub_type`
7. `.gitignore` يستثني: `node_modules/`, `yashjub.db`, `.env`, `.claude/`
8. API URLs تستخدم `window.location.origin` لتعمل محلياً وعلى الإنترنت بدون تعديل
9. الجوال يحتاج الرابط الحقيقي (Railway) — localhost لا يعمل على الجوال مباشرة

## تشغيل المشروع محلياً

```bash
cd Desktop/YASHJUB
node server.js
# افتح المتصفح على http://localhost:3000
```

## رفع التحديثات

```bash
git add .
git commit -m "وصف التغيير"
git push
# Railway يحدّث تلقائياً
```

## الميزات المنجزة

OTP دخول (محاكاة)، تمييز عميل/مزوّد، نظام طلبات كامل، صفحات طلب مخصصة لكل خدمة، نظام حاوية (حجم+أيام+تاريخ)، نظام سطحة (موقعين)، تتبع الطلب بالمراحل، لوحة مزوّد (إحصائيات+محفظة+طلبات)، تسجيل مزوّد (3 مستويات)، صفحة طلباتي، ملف شخصي، لوحة إدارة، صفحات عن/تواصل/شروط/404، وضع ليلي/نهاري، Responsive، رفع على Railway وGitHub.

## الميزات القادمة (غير مُنفَّذة بعد)

SMS حقيقي (Twilio)، خرائط Google Maps للتتبع، بوابة دفع حقيقية (STC Pay)، دومين yashjub.sa، تطبيق جوال (iOS/Android)، تقييم بعد اكتمال الطلب، إشعارات Push، نظام Escrow حقيقي، فواتير PDF، نظام Chat بين العميل والمزوّد، SMS إشعار للمزوّد عند طلب جديد.

## روابط مهمة

| الرابط | الوصف |
|---|---|
| `https://yashjub-production.up.railway.app` | الموقع الحي |
| `https://github.com/YASHJUB/yashjub` | GitHub |
| `https://railway.app` | لوحة تحكم الاستضافة |
| `/admin.html` | لوحة الإدارة |
| `/provider.html` | لوحة المزوّد |
