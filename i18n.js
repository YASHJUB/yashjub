// نظام تغيير اللغة المشترك بكل الموقع (عربي افتراضي / إنجليزي / أردو) — ثالث ملف JS مشترك بالمشروع (بعد alert.js وicons.svg)،
// نفس فلسفة الاستثناء المتعمّد من قاعدة "بدون JS مشترك": قاموس الترجمة ومحرك التطبيق أداة واحدة مطابقة بالضبط بكل صفحة، تكرارها كان راح يعني نسخ نفس الكود بعشرات الأماكن بدون أي فرق.

// flagIcon: اسم رمز SVG بـicons.svg (أعلام مرسومة يدوياً بدل إيموجي — إيموجي العلم ما يرندر كصورة فعلية بويندوز، يطلع كود الدولة النصي "SA"/"GB"/"PK" بدل الشكل، راجع "ثغرة الإيموجي" بالتوثيق)
const ATAD_LANGUAGES = {
    ar: { flagIcon: 'icon-flag-sa', label: 'العربية', dir: 'rtl' },
    en: { flagIcon: 'icon-flag-gb', label: 'English', dir: 'ltr' },
    ur: { flagIcon: 'icon-flag-pk', label: 'اردو',    dir: 'rtl' },
};

// قاموس الترجمة — المفتاح هو النص العربي الأصلي نفسه (نفس نص الـHTML/الكود)، بدل طبقة أسماء مفاتيح منفصلة — أبسط وأقل عرضة للخطأ
const ATAD_TRANSLATIONS = {
    'الخدمات':                  { en: 'Services',            ur: 'خدمات' },
    'اختر الخدمة المناسبة لك':   { en: 'Choose your service',  ur: 'اپنی خدمت منتخب کریں' },
    'سطحة':                     { en: 'Tow Truck',           ur: 'ٹو ٹرک' },
    'حاوية':                    { en: 'Container',           ur: 'کنٹینر' },
    'معدات ثقيلة':               { en: 'Heavy Equipment',     ur: 'بھاری آلات' },
    'أحدث الإعلانات':            { en: 'Latest Ads',          ur: 'تازہ اشتہارات' },
    'ابدأ الآن':                 { en: 'Start Now',           ur: 'ابھی شروع کریں' },
    'دخول':                     { en: 'Login',               ur: 'لاگ ان' },
    'إرسال':                    { en: 'Send',                ur: 'بھیجیں' },
    'بحث':                      { en: 'Search',              ur: 'تلاش' },
    'تواصل':                    { en: 'Contact',             ur: 'رابطہ' },
    'واتساب':                   { en: 'WhatsApp',            ur: 'واٹس ایپ' },
    'اتصال':                    { en: 'Call',                ur: 'کال' },
    'مراسلة':                   { en: 'Message',             ur: 'پیغام' },
    'انشر إعلانك':               { en: 'Post Your Ad',        ur: 'اشتہار دیں' },
    // إضافات بسيطة خارج القائمة الأصلية — نفس النصوص الفعلية المستخدمة بالموقع (بصياغة أطول قليلاً) لتفادي صفحة نص عربي مبعثر وسط لغة ثانية
    'انشر إعلانك الآن':          { en: 'Post Your Ad Now',    ur: 'ابھی اشتہار دیں' },
    'إعلان':                    { en: 'Ad',                  ur: 'اشتہار' },
};

function getLanguage() {
    return localStorage.getItem('atad_language') || 'ar';
}

// ترجمة نص عربي للغة الحالية — يرجّع نفس النص الأصلي لو ماكو ترجمة متوفرة له (passthrough آمن، ما يكسر أي نص غير مُترجَم بعد)
function t(arabicText) {
    const lang = getLanguage();
    if (lang === 'ar') return arabicText;
    const entry = ATAD_TRANSLATIONS[arabicText];
    return (entry && entry[lang]) || arabicText;
}

// يطبّق لغة معيّنة: يحفظها، يبدّل اتجاه/لغة الصفحة، يترجم كل عناصر [data-i18n] الثابتة، ويحدّث شكل زر التبديل والقائمة
function applyLanguage(lang) {
    if (!ATAD_LANGUAGES[lang]) lang = 'ar';
    localStorage.setItem('atad_language', lang);

    const meta = ATAD_LANGUAGES[lang];
    document.documentElement.setAttribute('dir', meta.dir);
    document.documentElement.setAttribute('lang', lang);

    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });

    const flagUseEl = document.getElementById('langSwitcherFlagUse');
    if (flagUseEl) flagUseEl.setAttribute('href', `icons.svg#${meta.flagIcon}`);

    document.querySelectorAll('.lang-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.lang === lang);
    });

    // أي صفحة فيها نصوص ديناميكية خاصة (مو ثابتة بـdata-i18n) تقدر تعرّف هذي الدالة لإعادة رسمها بعد تغيير اللغة
    if (typeof onLanguageChange === 'function') onLanguageChange();
}

function toggleLanguageDropdown(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('langDropdown');
    if (!dropdown) return;
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

function selectLanguage(lang) {
    applyLanguage(lang);
    const dropdown = document.getElementById('langDropdown');
    if (dropdown) dropdown.style.display = 'none';
}

document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('langDropdown');
    if (!dropdown || dropdown.style.display !== 'block') return;
    if (!e.target.closest('.lang-switcher')) dropdown.style.display = 'none';
});

// يُطبَّق فوراً وقت تحميل الصفحة (قبل أي سكربت خاص بالصفحة) — يغطّي عناصر [data-i18n] الثابتة بالـHTML مباشرة
applyLanguage(getLanguage());
