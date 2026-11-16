# مشروع عتاد (YASHJUB)

**تنبيه تسمية:** اسم المنصة المعروض للمستخدمين مرّ بتحوّلين متتاليين — من "يشجب" إلى "غَوْث" (مع لوقو جديد وقتها)، ثم من "غَوْث" إلى **"عتاد"** (الاسم الحالي). الاسم التقني القديم (`YASHJUB`) باقٍ كما هو بكل مكان تقني (اسم مستودع GitHub، الدومين `yashjub.onrender.com`، مفاتيح `localStorage` مثل `yashjub_phone`/`yashjub_name`، كلمة سر الإدارة `yashjub2025`، اسم مجلد المشروع). قائمة أسماء المستخدم المحجوزة `RESERVED_USERNAMES` بـ`server.js` فيها `'ghawth'` القديمة (كود/منطق تحقق، مو نص معروض). اسم دخول المدير البديل بـ`admin.js`'s `doLogin()` فيه نفس الشيء (`user === 'admin' || user === 'غوث'`) — بيانات اعتماد، مو نص عرض.

**ملاحظة تقنية على اللوقو (`images/logo.jpg`):** ملف JPEG بخلفية سوداء تقريباً نقية (`#000000`) بينما خلفية الهيدر بالموقع `#111111`. الحل: `mix-blend-mode: screen` على `.logo-img` (كل صفحات الهيدر العامة) و`.login-logo` (الجانب الأسود بـ`login.html`) — يدمج أسود اللوقو بخلفية الصفحة بدون أي صندوق ظاهر. **لا ينطبق على الاستخدامات على خلفيات بيضاء** (`.name-popup-logo`، `.covenant-logo`) — تبقى بصندوقها الأسود الطبيعي.

نص تحت اللوقو "مـوقـع عـتـاد" بكل صفحات الهيدر العامة (`index.html`, `about.html`, `contact.html`, `profile.html`, `privacy.html`, `terms.html`, `ads.html`, `ad-details.html`, `favorites.html`, `messages.html`, `fees.html`, `wallet.html`, `provider.html`). كلاس `.tagline` نفسه يُستخدم بصفحات ثانية بعنوان الصفحة الحالية بدل الشعار الثابت.

---

## ⚠️ تحوّل معماري كبير: إزالة النظام المدفوع بالكامل (آخر تحديث)

المنصة كانت أصلاً تجمع بين **نظامين متوازيين** يُفعَّل أحدهما فقط حسب مفتاح `ads_system` بجدول `system_settings`:
1. **النظام المدفوع** — العميل يطلب خدمة (وايت ماء/سطحة/حاوية/معدات ثقيلة) عبر المنصة، يدفع، والمزوّد يخدمه، والمنصة تأخذ 5% عمولة. هذا كان **النظام الافتراضي** منذ إطلاق المشروع.
2. **منصة عتاد معاهدة (نظام الإعلانات)** — المزوّد ينشر إعلان خدمة/بيع والعميل يتواصل معه مباشرة (واتساب/مكالمة) بدون عمولة، مع معاهدة شرعية تُلزمه بدفع 1% من قيمة الخدمة يدوياً.

**بطلب صريح من المستخدم، تمت إزالة النظام المدفوع بالكامل من الكود** (الواجهة والسيرفر)، وصار **نظام الإعلانات هو النظام الوحيد للمنصة دائماً** — بدون أي تبديل أو مفتاح تفعيل بعد الآن. **الكود الكامل للنظام المدفوع محفوظ على فرع `backup-paid-system`** على GitHub (`https://github.com/YASHJUB/yashjub/tree/backup-paid-system`) لو احتجنا الرجوع له أو مراجعته مستقبلاً — لم يُحذف نهائياً من تاريخ المشروع، فقط من فرع `main`.

**ما تم حذفه بالكامل:**
- **8 صفحات** (HTML+JS): `order.html` (صفحة الطلب)، `tracking.html` (تتبع الطلب الحقيقي + الخريطة)، `my-orders.html` (طلباتي)، `container-location.html`/`container-providers.html` (تدفق طلب الحاوية بخطوتين)، `register-provider.html` (تسجيل مزوّد جديد)، `invoice.html` (صفحة الفاتورة)، `provider-orders.html` (سجل طلبات المزوّد).
- **جداول/صفحات/APIs لوحة الإدارة**: الطلبات، الخدمات، العملاء (دمجت بـ"إدارة الأعضاء")، الموردون، طلبات التوثيق، المدفوعات، العمولات، الفواتير، كوبونات الخصم، مركز العمليات المباشر، المحادثات (شات الطلبات القديم) — ولوحة التحكم القديمة استُبدلت كلياً بلوحة تحكم الإعلانات (`adsDashboard`) كصفحة البداية الوحيدة.
- **APIs من `server.js`**: كل مجموعة `/api/orders/*`، `/api/providers/register`/`/approve`/`/reject`/`/availability`/`/work-area`/`/nearby`، `/api/products/*`، `/api/services/*`، `/api/coupons/*`، `/api/invoices/*`، `/api/reports/*`، `/api/operations/live`، `POST /api/chats` وباقي كتابة شات الطلبات، وفحوصها الدورية (`checkStaleOrders`، `autoReleaseOrders`).
- **فروع كود/واجهة** بكل الصفحات الباقية كانت تتفرّع بين "وضع مدفوع" و"وضع إعلانات" (index.html، login.html، about.html، contact.html، profile.html، wallet.html، provider.html، admin.html) — صارت كلها الفرع الوحيد (نسخة الإعلانات) بشكل دائم وثابت بالـHTML، بدون أي فحص `active-system` أو تبديل ديناميكي.

**ما بقي كما هو (جداول قاعدة بيانات، بدون حذف فعلي):** `orders`، `products`، `coupons`، `chats`، `services`، `invoices` باقية بالـschema (مُعلَّمة بتعليق `-- جداول النظام المدفوع (غير مستخدمة)` بـ`database.js`) لحفظ أي بيانات قديمة محلياً — بدون أي كود جديد يكتب فيها. **استثناء قراءة فقط**: `GET /api/orders/:id` و`GET /api/chats/:orderId` بقيا (بدون أي endpoint كتابة) لعرض تفاصيل طلب/محادثة قديمة مرتبطة بشكوى قديمة بلوحة الإدارة (قسم "البلاغات والشكاوى" يبقى يعرض شكاوى الطلبات القديمة بتفاصيلها الكاملة).

**جداول/APIs بقيت تعمل كما هي رغم ارتباطها التاريخي بالنظام المدفوع** (الطلب الأصلي لإزالة النظام لم يشملها صراحة): `reviews`/`ad_reviews`/`providers`/`testimonials` — الـAPIs كاملة باقية (`GET /api/providers`، كل `/api/reviews/*`، `/api/testimonials/*`)، لكن **بدون أي مسار واجهة جديد ينشئ بيانات فيها** (كانت تُنشأ فقط من `my-orders.html`/`tracking.html` المحذوفتين) — تبقى بيانات تاريخية للمزودين المسجَّلين قبل هذا التحديث (`loadProviderProfile()` بـ`provider.js` لسه يقرأ `providers.rating`/`reviews/provider/:phone` لو كان المستخدم مسجَّلاً بجدول `providers` من زمان، وإلا يبقى على القيم الافتراضية بدون أي خطأ).

**قيود/قرارات مرافقة للإزالة:**
- شارة "موثق" ببطاقة `provider.html` الرئيسية (`#providerBadge`) **تغيّر مصدرها بالكامل** — كانت تعرض مستوى تسجيل المزوّد القديم (`providers.level`: أساسي/موثق/شركة)، صارت تعرض **توثيق الحساب الإداري الحقيقي** (`users.is_verified`) بدل ذلك — مخفية بالكامل (`display:none`) لغير الموثقين، ظاهرة فقط لو وثّقته الإدارة من "إدارة الأعضاء"، بنفس تصميم `.verified-badge`/`icon-verified-badge` المستخدم بباقي الموقع. قرار متعمّد بما إن مفهوم "مستوى تسجيل مزوّد" (يتطلب `register-provider.html` المحذوفة) ما ينطبق على أي مستخدم جديد بعد الآن.
- زر "حسابي" ببطاقة `provider.html` يظهر دائماً الآن (كان مشروطاً بوضع الإعلانات)، وزر/toggle "متاح" (`availabilityToggleWrap`، مفهوم مدفوع بالكامل) **انحذف نهائياً**.
- قسم "منتجاتي" (لمزودي الحاوية، جدول `products`) وبطاقة "الطلب الوارد" (`newOrderSection`) انحذفا بالكامل من `provider.html` — ماكو تدفق طلب حاوية ولا طلبات حقيقية واردة بعد الآن.
- `employees`'s `ROLE_PAGES` (صلاحيات الموظفين) **أُعيد ربطها** بصفحات نظام الإعلانات بدل الصفحات المحذوفة (كانت كلها تشير لصفحات مدفوعة صارت غير موجودة): `supervisor` → إدارة الإعلانات + إدارة الأعضاء، `support` → البلاغات والشكاوى، `reviewer` → إدارة الأعضاء، `accountant` → إدارة العملات + رسوم المعاهدة + التقارير المالية. قرار تعويضي لأقرب صفحة بنفس طبيعة كل منصب — لم يُطلب صراحة، لكنه ضروري لأن الصفحات الأصلية المرتبطة بهذي الصلاحيات انحذفت كلياً.
- صفحة "النظام والسياسات" بلوحة الإدارة بقيت (حسب الطلب)، لكن **بدون أي toggle** — تعرض بطاقة واحدة ثابتة "منصة عتاد معاهدة - إعلانات: مفعّل ✅" للعرض فقط (`GET /api/settings`/`PUT /api/settings/:key` العامان باقيان بالسيرفر بدون استخدام فعلي من هذي الصفحة بعد الآن).
- `GET /api/settings/active-system` باقٍ بالسيرفر (يرجّع دايماً `{ activeSystem: 'ads' }` فعلياً بما إن `ads_system` ما عاد له مفتاح مدفوع يقارن به) لكن **ما يُستدعى من أي صفحة بعد الآن** — كل فروع "paid vs ads" بالواجهة أُزيلت نهائياً بدل الاعتماد على هذا الفحص.

---

منصة رقمية سعودية (سوق إعلانات/classifieds) تربط العملاء بمزودي خدمات ومعدات البناء والبنية التحتية — المزوّد ينشر إعلانه، والعميل يتصفح ويتواصل معه مباشرة (اتصال/واتساب/رسائل داخلية) بدون أي طلب أو دفع يمر بالمنصة.

- **الرابط الحالي:** `https://yashjub.onrender.com`
- **GitHub:** `https://github.com/YASHJUB/yashjub` (فرع النظام المدفوع القديم: `backup-paid-system`)
- **الاستضافة:** Render — يتحدّث تلقائياً عند كل `git push`. **قاعدة البيانات غير دائمة** (SQLite محلي مستثنى من git) — تنمحي مع كل نشر/تشغيل جديد على الخطة المجانية.

## الأقسام المتاحة (منصة عتاد معاهدة)

الأقسام الثلاثة فقط: `سطحة`، `حاوية`، `معدات ثقيلة` (بدون "وايت ماء") — ديناميكية بالكامل من جدول `ad_categories` (راجع "إعدادات الأقسام" بالأسفل)، مع نسخة ثابتة احتياطية بـ`app.js`/`provider.js` لو تعذّر الاتصال بالسيرفر.

كل مزوّد إعلان واحد فقط لكل (قسم + نوع إعلان) — `UNIQUE(provider_phone, category, ad_type)` بجدول `ads`.

### نوع الإعلان (خدمة/بيع — `ads.ad_type`)
كل إعلان له نوع: `service` (خدمة، الافتراضي) أو `sale` (بيع). فورم النشر بـ`provider.html` فيه تبويبان "خدمة"/"بيع" (`selectAdType()`) يبدّلان تسمية حقل السعر ("السعر من" ↔ "سعر البيع")، إظهار/إخفاء حقل "السعر إلى" (يختفي لإعلانات البيع — سعر واحد ثابت)، وplaceholder حقل الوصف. شارة `.ad-type-badge`/`.ad-card-type-badge` (أصفر/أسود، بدون أيقونة) تظهر بكل بطاقة إعلان وصفحة التفاصيل ولوحة الإدارة. فلتر "نوع الإعلان" (الكل/خدمة/بيع) موجود بصفحة `ads.html` وبجدول "إدارة الإعلانات" بلوحة الإدارة.

### "اختر نوع العدة" — فلترة قسم "معدات ثقيلة" (عمود `ads.equipment_type`)
الضغط على صف "معدات ثقيلة" بالصفحة الرئيسية (`openAdsEquipmentPanel()`) يفتح لوحة "اختر نوع العدة" بالستة أنواع (بوكلين/شيول/قلابي/بوبكات/خرسانة/رافعة، `AD_EQUIPMENT_TYPES` بـ`app.js`)، كل بطاقة تعرض عدد الإعلانات الفعلي لنفس النوع. نشر إعلان بقسم "معدات ثقيلة" يتطلب تحديد نوع العدة إلزامياً (تحقق مزدوج: واجهة + سيرفر). `GET /api/ads` يدعم فلتر `equipment_type` إضافي يستخدمه `ads.js` لو كان بالرابط `?equipment=X`.

**قيد معروف ومتعمّد:** هذي الفلترة مربوطة بمطابقة نصّية حرفية لاسم `'معدات ثقيلة'` بعدة ملفات (`app.js`, `provider.js`) — ما تحوّلت لمنطق مبني على القسم الديناميكي الجديد؛ لو الأدمن غيّر اسم هذا القسم من "إعدادات الأقسام"، الميزة تتوقف بصمت.

### ماكو تسجيل مزوّد منفصل
`POST /api/ads` ما يتحقق من وجود `providerPhone` بجدول `providers` إطلاقاً (مجرد حقل نصي بجدول `ads`) — أي مستخدم مسجّل دخوله (بغض النظر عن `yashjub_type`) يقدر ينشر إعلاناً مباشرة من `provider.html#adsSection`. `provider.js`'s `loadProvider()` يكفيها إن المستخدم مسجّل دخوله فقط.

### معاهدة عتاد (`ads.accepted_covenant`/`covenant_accepted_at`)
نشر إعلان **جديد** (مو تعديل) يفتح popup إلزامي قبل أي اتصال فعلي بالسيرفر: بطاقة بيضاء بحد ذهبي فيها لوقو المنصة، "بسم الله الرحمن الرحيم"، آية ﴿وَأَوْفُواْ بِعَهْدِ اللَّهِ...﴾، بندين (رسوم المنصة `covenant_fee_percent`% من قيمة الخدمة، والسداد خلال `covenant_payment_days` يوم — كلاهما ديناميكي من جدول `app_config`، راجع "إعدادات المعاهدة")، آية ﴿وَإِنَّهُ لَقَسَمٌ...﴾، ثم مربّع اختيار "أتعهد بذلك" — زر "نشر الإعلان" يبقى معطّلاً لحد تفعيل الاختيار. **`server.js` هو المصدر الموثوق النهائي**: `POST /api/ads` يرفض صراحة أي إعلان جديد بدون `acceptedCovenant` صحيح. `PUT /api/ads/:id` (التعديل) ما يمسّ عمودَي الموافقة إطلاقاً. **نص المعاهدة الديني نفسه غير قابل للتعديل من لوحة الإدارة** (حساسية تحريف نص قرآني) — فقط الرقمان (النسبة والمهلة) ديناميكيان.

### حاسبة الرسوم والدفع (`fees.html`/`fees.js` — جدول `fee_payments`)
صفحة مستقلة تحسب رسوم معاهدة عتاد (`covenant_fee_percent`% من قيمة الخدمة) وتسجّل دفعها يدوياً — تُسجَّل بحالة `paid` فوراً دون أي تحقق فعلي (**ماكو بوابة دفع حقيقية بالمشروع أصلاً**). نافذة اختيار طريقة الدفع (تحويل بنكي/STC Pay/مدى، بيانات تجريبية) → `POST /api/fees/pay`. سجل "المدفوعات السابقة" من `GET /api/fees/:phone`.

### نظام الرسائل الداخلي (`messages.html`/`messages.js` — جدولا `conversations`/`messages`)
نظام مراسلة حقيقي بين العميل والمعلن، منفصل تماماً عن نظام التتبع القديم.
- **البدء من `ad-details.html`**: زر "مراسلة 💬" يستدعي `startConversation()` → `POST /api/conversations` (idempotent — يرجّع المحادثة الموجودة أصلاً لنفس الإعلان بين نفس الطرفين بدل تكرارها) ثم تحويل لـ`messages.html?conversation=ID&draft=TEXT`.
- `conversations`: `ad_id`/`ad_title`، `user1_phone` (البادئ)، `user2_phone` (صاحب الإعلان)، `last_message`/`last_message_at`. `messages`: `conversation_id`، `ad_id`، `sender_phone`/`receiver_phone`، `message`، `is_read`. `POST /api/messages` يحدّد `receiver_phone` من طرفي المحادثة بالسيرفر نفسه (أمان أكثر من الاعتماد على مُدخل العميل).
- `messages.html` تصميم عمودين (قائمة محادثات / محادثة نشطة)، تستطلع كل 10 ثواني، فتح محادثة يعلّمها مقروءة. وضع الجوال يقلب بين القائمة والمحادثة.
- badge "الرسائل" بالسايد بار (`.sidebar-badge`) = مجموع `my_unread_count` من كل محادثات المستخدم (`GET /api/conversations/:phone` — محسوب حياً لكل طرف بشكل منفصل، عمود `unread_count` بالجدول غير معتمد فعلياً لأنه ما يقدر يمثّل طرفين بعمود وحد).
- إشعار تلقائي لصاحب الإعلان عند كل رسالة جديدة.

### نظام العملات الذهبية 🪙 (جداول `coins_packages`/`user_coins`/`coins_transactions` — تصدير الإعلانات)
المعلن يشتري "عملات ذهبية" (نظرياً — ماكو بوابة دفع حقيقية، الضغط على طريقة الدفع يعرض "سيتم تفعيل الدفع قريباً... تواصل معنا على واتساب") ويصرفها لتصدير إعلانه (`feature_ad_coin_cost` عملة = `feature_ad_duration_hours` ساعة بأعلى الترتيب، كلاهما ديناميكي من `app_config`، افتراضياً 10/24).

**`wallet.html`/`wallet.js`** هي صفحة محفظة العملات الآن بالكامل (كانت أصلاً تتفرّع بين محفظة أرباح مزوّد مدفوعة ومحفظة عملات — الأولى انحذفت بالكامل مع النظام المدفوع). تعرض الرصيد، باقات الشراء (`coins_packages`)، وسجل المعاملات.

5 باقات ثابتة تُزرع أول تشغيل (30/59+9/109+33/274+90/824+280 عملة). `GET /api/ads` يرتّب `is_featured DESC` أولاً — الإعلانات المتصدرة تطلع أول القائمة دايماً.

`POST /api/coins/feature-ad` بدون تحقق ملكية الإعلان (نفس نمط عدم-التحقق بباقي المشروع). `POST /api/coins/expire-featured` يشتغل تلقائياً كل ساعة.

### نظام مفضلة الإعلانات ❤️ (جدول `favorites`)
أي مستخدم مسجّل دخوله يقدر يحفظ إعلانات بقائمة مفضلة خاصة فيه (زر قلب بزاوية أي بطاقة، تحديث فوري بصري قبل انتظار رد السيرفر). `favorites.html` صفحة مستقلة لعرض القائمة الكاملة. 4 endpoints: `POST`/`DELETE /api/favorites/...`, `GET /api/favorites/check/...`, `GET /api/favorites/:phone`.

### نظام تعليقات الإعلانات 💬 (جدول `comments`)
أي مستخدم مسجّل دخوله يقدر يعلّق على أي إعلان من `ad-details.html` — عام وظاهر للجميع تحت الإعلان، منفصل عن التقييمات والرسائل. إشعار فوري لصاحب الإعلان عند كل تعليق جديد (إلا لو كان هو نفسه المعلّق). حذف من صاحب التعليق أو صاحب الإعلان (client-side فقط). لوحة الإدارة فيها "إدارة التعليقات" (كل تعليقات كل الإعلانات) + panel عرض تعليقات إعلان واحد ضمن "إدارة الإعلانات".

### إعلانات ذات صلة (`ad-details.html`)
شبكة 3×3 صور من نفس قسم الإعلان الحالي (`GET /api/ads?category=...&limit=9&exclude=ID`) — مربوطة بالقسم مباشرة، بدون نص. أقل من 9 إعلانات = الباقي مربعات رمادية فاضية (تظهر دايماً 9 مربعات بالضبط).

### توثيق الحسابات (✅ — `users.is_verified`/`verified_at`/`verified_by`)
علامة توثيق إدارية (مو تلقائية) — المدير العام أو موظف لوحة الإدارة يوثّق حساب أي مستخدم يدوياً من "إدارة الأعضاء"، فتظهر علامة ✅ ذهبية (دائرة + صح أسود، `icon-verified-badge`) بجانب اسمه بكل مكان: بطاقة `.ad-card`، صفحة تفاصيل الإعلان (المعلن فقط — انحذف التعليقات حسب الطلب، باقٍ بالرسائل الداخلية فقط)، ونظام الرسائل. `PUT /api/users/:phone/verify`/`unverify`. `profile.html`'s صف "نوع الحساب" يعرض حالة التوثيق بدل عميل/مزوّد (`renderVerificationStatus()`).

### الصورة الشخصية (أفاتار — `users.avatar_path`)
أي مستخدم يقدر يرفع صورته الشخصية (JPG أو PDF فقط، ≤5MB) بدل الأيقونة الافتراضية، من `profile.html` فقط. `PUT`/`DELETE /api/users/:phone/avatar`. تُعرض بكل دائرة سايد بار وبطاقة `provider.html` الرئيسية عبر `localStorage.yashjub_avatar`.

### اسم العضوية (@username — `users.username`/`username_changed_at`)
كل مستخدم له اسم عضوية فريد `@username` يُنشأ تلقائياً أول تسجيل دخول ناجح (`user` + آخر 6 أرقام من الجوال، مع تفادي تصادم). يُغيَّر من `profile.html` مرة كل 30 يوم (`PUT /api/users/:phone/username`)، بتحقق فوري من التوفر (`GET /api/users/check-username/:username`). يظهر بصفحة تفاصيل الإعلان، التعليقات، التقييمات.

## أنواع المستخدمين

**العميل/المعلن:** تسجيل دخول برقم الجوال + OTP (محاكاة، يظهر بـ`alert`)، دخول موحّد بدون تمييز عميل/مزوّد يدوي — `POST /api/auth/verify-otp` يرجّع `isProvider` (مزوّد معتمد فعلياً بجدول `providers` من قبل هذا التحديث أم لا) يُستخدم لتعيين `yashjub_type` تلقائياً، لكن **التوجيه بعد الدخول واحد للجميع دايماً: `index.html`**.

### اسم المستخدم (`users.name`)
أول تحقق OTP وما عنده اسم محفوظ، نافذة ترحيب إلزامية تطلبه (`PUT /api/users/:phone/name`، `localStorage.yashjub_name`). يظهر بدل "معلن"/"عميل" بسايد بار `index.html` وبطاقة `provider.html` الرئيسية.

### إعدادات الحساب (`profile.html`)
تغيير البريد (`PUT /api/users/:phone/email`)، تغيير رقم الجوال (OTP على الرقم الجديد + ترحيل شامل لكل البيانات المرتبطة بالرقم القديم بجداول `users`/`ads`/`notifications`/`complaints`/`reviews`/`testimonials`/`ad_reviews` — ضمن transaction واحدة)، حذف الحساب نهائياً (يحذف المستخدم وكل إعلاناته وتقييماتها).

**المزوّد/المعلن (مستويان قديمان، `providers.level` — غير قابلين للتسجيل الجديد بعد الآن):**
كانت المنصة أصلاً تدعم تسجيل مزوّد حقيقي بمستويين (موثّق/شركة) برفع مستندات وموافقة إدارة — هذا التدفق (`register-provider.html`) **انحذف بالكامل** مع إزالة النظام المدفوع. جدول `providers` باقٍ بالبيانات القديمة فقط (رفع المستندات، `GET /api/providers` للقراءة)، بدون أي endpoint تسجيل/موافقة/رفض جديد.

### إدارة الموظفين وصلاحيات لوحة الإدارة
نفس صفحة دخول لوحة الإدارة (`/admin.html`) تقبل المدير العام (بيانات ثابتة بـ`admin.js`) أو موظف مُسجَّل بجدول `employees` (`POST /api/employees/login`، bcrypt). قسم "إدارة الموظفين" يظهر فقط للمدير العام أو موظف بمنصب `admin`.

**صلاحيات كل منصب** (`ROLE_PAGES` بـ`admin.js`، أُعيد ربطها بصفحات الإعلانات بعد إزالة النظام المدفوع):
| المنصب | الصفحات المتاحة |
|---|---|
| `admin` | كل الصفحات (بدون قيود) + إدارة الموظفين |
| `supervisor` | إدارة الإعلانات، إدارة الأعضاء |
| `support` | البلاغات والشكاوى |
| `reviewer` | إدارة الأعضاء |
| `accountant` | إدارة العملات، رسوم المعاهدة، التقارير المالية |

**تنبيه أمني معروف ومقبول:** الصلاحيات هذي كلها client-side فقط — كلمة سر المدير العام نفسها مكتوبة صراحة بـ`admin.js`، وكل endpoints الـAPI بدون أي تحقق هوية حقيقي من المتصل.

### الأيقونات (SVG sprite — `icons.svg`)
كل أيقونات الموقع SVG (`fill:currentColor` عبر `.icon` CSS class، يتبع لون النص تلقائياً بالوضع الليلي/النهاري) بدل إيموجي. أعلام لغات (`icon-flag-sa`/`gb`/`pk`) مرسومة يدوياً بكلاس منفصل `.flag-icon` (بدون `fill:currentColor`، لأنها تحتاج ألوانها الثابتة). `icon-verified-badge` (دائرة ذهبية + صح أسود) لعلامة التوثيق.

### نافذة التنبيهات الموحّدة (`alert.js`)
`window.alert()` الافتراضي مُستبدَل بالكامل بنافذة مخصّصة بهوية المنصة (`showAppAlert(message, onClose)`) — غير حاجزة (non-blocking)، فأي كود كان يعتمد على تأخير `alert()` تحوّل لـ`showAppAlert(msg, () => {...})`.

### نظام تغيير اللغة (`i18n.js` — `index.html` فقط حالياً)
مبدّل لغة (عربي/إنجليزي/أردو) بالهيدر. قاموس `ATAD_TRANSLATIONS` (المفتاح = النص العربي الأصلي) قابل للتعديل من لوحة الإدارة (جدول `translations`، يغذّي `ATAD_TRANSLATIONS_OVERRIDE`). ترجمة نصّية فقط فوق تخطيط RTL بصري ثابت (مو LTR حقيقي).

## هيكل الملفات

```
yashjub/
├── index.html / app.js              الصفحة الرئيسية (أقسام الإعلانات)
├── login.html / login.js            تسجيل الدخول (دخول موحّد)
├── provider.html / provider.js      "إعلاناتي" — إدارة إعلانات المستخدم + تقييماته التاريخية
├── ads.html / ads.js                قائمة إعلانات قسم معيّن (?category=NAME)
├── ad-details.html / ad-details.js  تفاصيل إعلان + تقييماته + تعليقاته (?id=AD_ID)
├── fees.html / fees.js              حاسبة رسوم المعاهدة + دفع يدوي + سجل مدفوعات
├── messages.html / messages.js      الرسائل الداخلية (محادثات عميل↔معلن)
├── favorites.html / favorites.js    قائمة مفضلة الإعلانات ❤️
├── wallet.html / wallet.js          محفظة العملات الذهبية 🪙
├── profile.html / profile.js        الملف الشخصي
├── admin.html / admin.js            لوحة الإدارة (نظام الإعلانات فقط)
├── about.html / about.js, contact.html / contact.js, terms.html, privacy.html, 404.html
├── server.js                        السيرفر الرئيسي (Express)
├── database.js                      إعداد قاعدة البيانات
├── style.css                        التصميم الكامل
├── icons.svg                        مكتبة أيقونات SVG المشتركة
├── alert.js                         نافذة التنبيهات الموحّدة المشتركة
├── i18n.js                          نظام تغيير اللغة المشترك — index.html فقط حالياً
├── yashjub.db                       قاعدة بيانات SQLite (مستثناة من git)
└── images/                          logo.jpg, banner.jpeg
```

**محذوفة بالكامل (موجودة فقط على فرع `backup-paid-system`):** `order.html/.js`، `tracking.html/.js`، `my-orders.html/.js`، `container-location.html/.js`، `container-providers.html/.js`، `register-provider.html/.js`، `invoice.html/.js`، `provider-orders.html/.js`.

## التقنيات

**Frontend:** HTML5, CSS3, JavaScript (Vanilla) — خط Cairo من Google Fonts — RTL دائماً (عربي أولاً) — Responsive (جوال أولاً)

**قاعدة البيانات (SQLite):**
```sql
users       -- phone, otp, verified, name, email, avatar_path, username, username_changed_at, is_verified, verified_at, verified_by, suspended_until
providers   -- بيانات تسجيل قديمة فقط (قراءة)، id_document_path, certificate_path, driving_license_path/vehicle_registration_path/transport_permit_path, level, rating, work_lat/work_lng/work_radius/work_city — ماكو endpoint تسجيل/موافقة جديد
employees   -- name, phone, iban, role (admin/supervisor/support/reviewer/accountant), username, password (bcrypt), is_active
cities      -- name, is_active — تغذي اختيار المدينة بفورم نشر الإعلان وفلتر ads.html
notifications -- title، message، type (alert/offer/update/urgent)، target، target_phone، receiver_phone، is_read
complaints  -- order_id (تاريخي، nullable)، ad_id (بلاغ عن إعلان)، reporter_phone، reporter_type، reported_phone، reported_type، type، description، status، admin_note، action_taken، resolved_at
reviews     -- تاريخي فقط (بدون مسار إنشاء جديد بعد حذف my-orders.html/tracking.html) — order_id، reviewer/reviewed phone/type، rating، comment، admin_reply، is_visible، is_flagged
testimonials -- تاريخي فقط (بدون مسار إنشاء جديد) — client_phone، client_name، rating، comment، service، status
ads         -- provider_phone، provider_name، category، ad_type (service/sale)، equipment_type، title، description، price_from، price_to، city، district، whatsapp، images (JSON)، is_active، views_count، accepted_covenant، covenant_accepted_at، is_featured، featured_until، featured_count — UNIQUE(provider_phone, category, ad_type)
ad_reviews  -- ad_id، reviewer_phone، reviewer_name، rating، comment — تقييمات الإعلانات
fee_payments -- provider_phone، service_amount، fee_amount، payment_method، status (دايماً paid)
conversations / messages -- الرسائل الداخلية المرتبطة بالإعلانات
coins_packages / user_coins / coins_transactions -- نظام العملات الذهبية
favorites   -- phone، ad_id — UNIQUE(phone, ad_id)
comments    -- ad_id، commenter_phone، commenter_name، comment، is_visible
ad_categories -- name، name_en، name_ur، icon، min_price، is_active، sort_order — أقسام الإعلانات الديناميكية
app_config  -- key/value نصي — تكلفة/مدة تصدير الإعلان، نسبة/مهلة رسوم المعاهدة
translations -- ar_key (= النص العربي الأصلي)، en، ur
banned_words -- word — فلتر محتوى اختياري (العناوين/الأوصاف/التعليقات)، التفعيل عبر system_settings.banned_words_filter
system_settings -- key/value بوليني — ads_system (دايماً true فعلياً الآن)، banned_words_filter

-- جداول النظام المدفوع (غير مستخدمة، بيانات قديمة فقط، بدون كود كتابة جديد):
orders، products، coupons، chats، services، invoices
```

**Backend:** Node.js + Express.js, better-sqlite3, CORS + dotenv, multer (رفع الملفات)، bcryptjs (تشفير كلمات مرور الموظفين)، sharp (علامة مائية على صور الإعلانات)

**API Endpoints (الوضع الحالي، بعد إزالة النظام المدفوع):**
```
POST /api/auth/send-otp | POST /api/auth/verify-otp
PUT  /api/users/:phone/name | /email | /username | /verify | /unverify | /avatar | /change-phone | /suspend | /unsuspend
DELETE /api/users/:phone | /api/users/:phone/avatar
GET  /api/users | /api/users/check-username/:username
GET  /api/providers                             (قراءة فقط — بيانات تسجيل قديمة، بدون أي endpoint كتابة جديد)
POST /api/employees | GET /api/employees | PUT/DELETE /api/employees/:id | POST /api/employees/login
GET/POST/PUT/DELETE /api/cities, /api/cities/active
GET/POST/PUT/DELETE /api/ad-categories, /api/ad-categories/active
GET  /api/settings | PUT /api/settings/:key | GET /api/settings/active-system   (باقٍ بدون استخدام فعلي من الواجهة)
GET/PUT /api/config/:key | GET /api/translations | PUT /api/translations/:key
GET/POST/DELETE /api/banned-words/:id
POST /api/ads | GET /api/ads (فلاتر: category, equipment_type, city, district, price_from/to, providerPhone, ad_type, includeInactive, exclude, limit)
GET  /api/ads/provider/:phone/stats | GET/PUT/DELETE /api/ads/:id
POST /api/ads/:id/reviews | GET /api/ads/:id/reviews | POST /api/ads/:id/images
POST /api/fees/pay | GET /api/fees/:phone | GET /api/fees
GET/POST/PUT /api/coins/packages | GET /api/coins/balance/:phone | POST /api/coins/purchase
POST /api/coins/feature-ad | GET /api/coins/transactions(/:phone) | POST /api/coins/gift | POST /api/coins/expire-featured
POST/GET/DELETE /api/favorites... | GET /api/favorites/check/:ad_id/:phone | GET /api/favorites/:phone
POST /api/comments | GET /api/comments | GET /api/comments/:ad_id | DELETE /api/comments/:id | PUT /api/comments/:id/hide
POST /api/conversations | GET /api/conversations/:phone | GET /api/messages/:conversationId | POST /api/messages | PUT /api/messages/:conversationId/read
GET  /api/notifications/:phone | PUT .../read | PUT /read-all/:phone | DELETE /api/notifications/:id | GET /api/notifications/admin/all | POST /api/notifications/send
POST /api/complaints | GET /api/complaints(/:id, /user/:phone) | PUT /api/complaints/:id/status | PUT /api/complaints/:id/action
POST /api/reviews | GET /api/reviews | GET /api/reviews/stats | GET /api/reviews/provider/:phone | PUT .../visibility|reply|flag | DELETE /api/reviews/:id
POST /api/testimonials | GET /api/testimonials/approved|all | PUT /api/testimonials/:id/status | DELETE /api/testimonials/:id
GET  /api/orders/:id | GET /api/chats/:orderId        (استثناء قراءة فقط — لعرض شكاوى/طلبات تاريخية بلوحة الإدارة، بدون أي endpoint كتابة)
```

**محذوفة بالكامل من `server.js`** (موجودة فقط على فرع `backup-paid-system`): كل `/api/orders/*` (كتابة)، `/api/providers/register`/`approve`/`reject`/`availability`/`work-area`/`nearby`، `/api/products/*`، `/api/services/*`، `/api/coupons/*`، `/api/invoices/*`، `/api/reports/*`، `/api/operations/live`، `POST /api/chats` وباقي كتابة شات الطلبات.

### إدارة الأقسام/الإعدادات الديناميكية (لوحة الإدارة — وضع الإعلانات)
- **إعدادات الأقسام** (`ad_categories`): CRUD كامل، تغذي صفوف الأقسام بالصفحة الرئيسية وفورم نشر الإعلان ديناميكياً.
- **إعدادات العملات** (`app_config`: `feature_ad_coin_cost`/`feature_ad_duration_hours`).
- **إعدادات المعاهدة** (`app_config`: `covenant_fee_percent`/`covenant_payment_days`) — الأرقام فقط، نص المعاهدة الديني ثابت.
- **إعدادات اللغات** (`translations`): تعديل ترجمات En/Ur لقاموس `i18n.js` الموجود (بدون إضافة مفاتيح جديدة).
- **الكلمات المحظورة** (`banned_words` + `system_settings.banned_words_filter`).

### لوحة إدارة نظام الإعلانات (`admin.html`)
السايد بار الآن قسمان دائمان بدون أي تبديل: **إدارة المحتوى** (لوحة التحكم، إدارة الإعلانات، إدارة الأعضاء، إدارة التعليقات) و**المالية** (إدارة العملات، رسوم المعاهدة، التقارير المالية)، بجانب **الإعدادات** (الأقسام/العملات/المعاهدة/اللغات/الكلمات المحظورة/المدن)، **التواصل** (الإشعارات، البلاغات والشكاوى)، و**أخرى** (التقييمات، الشهادات، النظام والسياسات، إدارة الموظفين).

**لوحة التحكم (`adsDashboard`)** هي الصفحة الافتراضية الوحيدة الآن — 6 بطاقات إحصائية (إعلانات نشطة، إجمالي الأعضاء، إعلانات متصدرة، إجمالي المشاهدات، تعليقات اليوم، بلاغات إعلانات جديدة)، أكثر الأقسام نشاطاً، آخر 10 إعلانات، آخر 5 أعضاء — كل البيانات محسوبة client-side من `GET /api/ads`/`users`/`comments`/`complaints`.

**إدارة الأعضاء**: جدول المستخدمين (توثيق/إلغاء توثيق، 🪙 إضافة عملات هدية، 🚫 إيقاف/تفعيل، 🗑️ حذف).

**إدارة التعليقات**: كل تعليقات كل الإعلانات، إخفاء/إظهار/حذف.

**بلاغات الإعلانات**: توسعة لصفحة "البلاغات والشكاوى" الموجودة (`complaints.ad_id`) — زر 🚩 بصفحة تفاصيل الإعلان يرسل البلاغ، يظهر بفلتر "📢 إعلانات" بالإدارة مع زرّي "عرض الإعلان"/"حذف الإعلان" بجانب الإجراءات السبعة العادية.

## نظام البلاغات والشكاوى (جدول `complaints`)
العميل/المزوّد يقدّم شكوى (نوع + تفاصيل حرة) — إما مرتبطة بإعلان (`ad_id`، من زر 🚩 بصفحة الإعلان) أو شكوى قديمة مرتبطة بطلب تاريخي (`order_id`، من قبل إزالة النظام المدفوع). **الإجراءات السبعة** عبر `PUT /api/complaints/:id/action` (endpoint واحد، `actionType` مختلف): تم الحل، استرداد المبلغ (تسجيل إداري فقط — ماكو Escrow حقيقي)، إرسال تحذير، إيقاف مؤقت (حقيقي — `suspended_until`)، حذف الحساب نهائياً، إرسال رد، إغلاق بدون إجراء. بانل التفاصيل يجلب تفاصيل الطلب/المحادثة التاريخية لو الشكوى مرتبطة بـ`order_id` قديم (`GET /api/orders/:id`/`GET /api/chats/:orderId` — قراءة فقط).

## نظام الإشعارات (جدول `notifications`)
صف واحد لكل مستلم. الإرسال اليدوي من لوحة الإدارة (4 خيارات مستلم). الإشعارات التلقائية المتبقية: تسجيل مستخدم جديد (لا — هذا للمزودين القدامى فقط وانحذف)، رسالة جديدة (نظام الرسائل)، تعليق جديد، شكوى جديدة/بدون حل 24 ساعة/تكرار 3 شكاوى، توثيق حساب. جرس الإشعارات بهيدر `index.html`.

## هوية التصميم

```css
--black:  #111111
--yellow: #F5C518
--white:  #FFFFFF
--gray:   #FAFAFA
--green:  #10B981
--red:    #EF4444
```

Arabic First (RTL دائماً) — Mobile First — Minimal — خط Cairo — بطاقات بزوايا مستديرة (`border-radius: 16px`) — بلا gradients.

### الوضع الليلي/النهاري
`toggleTheme()`/`loadTheme()` مكرَّرتان بكل ملف JS، زر `#themeBtn` بكل الصفحات العامة عدا `admin.html`/`404.html`.

## ملاحظات مهمة للمطوّر

1. السيرفر محلياً على port 3000 — على الاستضافة يقرأ `process.env.PORT`.
2. قاعدة البيانات `yashjub.db` محلية وغير دائمة على Render.
3. كلمة مرور الإدارة: `yashjub2025`.
4. OTP الحالي محاكاة فقط — يظهر في alert.
5. **ماكو عمولة بعد الآن** (كانت 5% بالنظام المدفوع، أُزيلت معه) — رسوم معاهدة عتاد (1% افتراضياً) تُدفع يدوياً من المعلن عبر `fees.html`.
6. localStorage يحفظ `yashjub_phone`، `yashjub_type`، `yashjub_name`، `yashjub_avatar`، `yashjub_username`.
7. `.gitignore` يستثني: `node_modules/`, `yashjub.db`, `.env`, `.claude/`, `uploads/`.
8. API URLs تستخدم `window.location.origin`.
9. **النظام المدفوع بالكامل (كود + توثيق) محفوظ على فرع `backup-paid-system`** لو احتجنا مراجعته أو استرجاعه مستقبلاً.

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
# Render يحدّث تلقائياً
```

## الميزات المنجزة

OTP دخول (محاكاة)، منصة عتاد معاهدة — نظام إعلانات مجاني كامل (نشر/تعديل/حذف بتبويبي خدمة/بيع، تصفح وبحث وفلترة بدون تسجيل دخول، تواصل مباشر اتصال/واتساب/رسائل داخلية، معاهدة شرعية، إدارة كاملة بلوحة الإدارة)، حاسبة رسوم المعاهدة، نظام عملات ذهبية 🪙 لتصدير الإعلانات، نظام مفضلة ❤️، نظام تعليقات 💬، إعلانات ذات صلة، توثيق حسابات إداري ✅، صورة شخصية موحّدة، اسم عضوية @username، نظام رسائل داخلي بين العميل والمعلن، نظام إشعارات كامل، نظام بلاغات وشكاوى كامل (يشمل بلاغات الإعلانات والشكاوى التاريخية)، إدارة موظفين بصلاحيات حسب المنصب، إدارة مدن/أقسام/عملات/معاهدة/لغات/كلمات محظورة ديناميكية بلوحة الإدارة، وضع ليلي/نهاري، Responsive، أيقونات SVG موحّدة، نافذة تنبيهات موحّدة، نظام تغيير لغة (عربي/إنجليزي/أردو، `index.html` فقط)، رفع على Render وGitHub.

**إزالة النظام المدفوع بالكامل** (الطلبات الفورية/المجدولة، تسجيل المزودين، تتبع الطلب، الفواتير، العمولة، مركز العمليات، شات الطلبات، كوبونات الخصم) — محفوظ على فرع `backup-paid-system` لو احتجناه مستقبلاً.

## الميزات القادمة (غير مُنفَّذة بعد)

SMS حقيقي، بوابة دفع حقيقية (لشراء العملات ودفع رسوم المعاهدة)، دومين `yashjub.sa`، تطبيق جوال، إشعارات Push، تخزين دائم لقاعدة البيانات والملفات المرفوعة، توسيع نظام تغيير اللغة لباقي الصفحات.

## روابط مهمة

| الرابط | الوصف |
|---|---|
| `https://yashjub.onrender.com` | الموقع الحي |
| `https://github.com/YASHJUB/yashjub` | GitHub (فرع `main`) |
| `https://github.com/YASHJUB/yashjub/tree/backup-paid-system` | كود النظام المدفوع القديم (مرجعي فقط) |
| `https://dashboard.render.com` | لوحة تحكم الاستضافة |
| `/admin.html` | لوحة الإدارة |
| `/provider.html` | "إعلاناتي" |
