// كود تسجيل المزود في غَوْث

// بوضع الإعلانات ماكو حاجة لتسجيل مزوّد منفصل — أي مستخدم مسجّل دخوله ينشر إعلاناته مباشرة من "إعلاناتي" (provider.html#adsSection)
// تحويل فوري بدون أي رسالة (نفس نمط my-orders.js) — تفادياً لظهور فورم التسجيل كاملاً خلف نافذة التنبيه غير الحاجزة قبل التحويل
(async function redirectAwayInAdsMode() {
    try {
        const res  = await fetch(window.location.origin + '/api/settings/active-system');
        const data = await res.json();
        if (data.activeSystem === 'ads') window.location.href = 'login.html';
    } catch (e) {}
})();

let selectedLevel = 0;

// اختيار المستوى
function selectLevel(level) {
    selectedLevel = level;

    // إزالة التحديد من الكل
    document.querySelectorAll('.level-card').forEach(c => c.classList.remove('selected'));

    // تحديد البطاقة المختارة
    document.getElementById(`level${level}Card`).classList.add('selected');

    // إظهار النموذج
    document.getElementById('regFormSection').style.display = 'block';

    // تحديث عنوان النموذج
    const titles = {
        2: '<svg class="icon"><use href="icons.svg#icon-edit-pencil"></use></svg> تسجيل مزود فرد — مزود موثق',
        3: '<svg class="icon"><use href="icons.svg#icon-edit-pencil"></use></svg> تسجيل منشأة - شركة — شركة / منشأة'
    };
    document.getElementById('regFormTitle').innerHTML = titles[level];

    // إخفاء / إظهار الحقول
    document.getElementById('level2Fields').style.display = level >= 2 ? 'block' : 'none';
    document.getElementById('level3Fields').style.display = level === 3 ? 'block' : 'none';

    // تمرير للنموذج
    document.getElementById('regFormSection').scrollIntoView({ behavior: 'smooth' });
}

// إظهار/إخفاء حقول إضافية حسب نوع الخدمة (تنويه الحاوية، وثائق السطحة)
function toggleContainerNote() {
    const serviceType = document.getElementById('serviceType').value;
    document.getElementById('containerNote').style.display = serviceType === 'حاوية' ? 'block' : 'none';
    document.getElementById('towingFields').style.display  = serviceType === 'سطحة'  ? 'block' : 'none';
}

// تمييز الحقل الناقص بحد أحمر والتمرير إليه
function highlightFieldError(id) {
    document.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));

    const field = document.getElementById(id);
    if (!field) return;

    const target = field.closest('.terms-check') || field;
    target.classList.add('field-error');
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (field.focus) field.focus({ preventScroll: true });
}

// إزالة تمييز الخطأ بمجرد ما المستخدم يبدأ يعدّل بالحقل
document.addEventListener('input', (e) => {
    if (e.target.classList.contains('field-error')) e.target.classList.remove('field-error');
    const wrap = e.target.closest('.terms-check');
    if (wrap) wrap.classList.remove('field-error');
});
document.addEventListener('change', (e) => {
    if (e.target.classList.contains('field-error')) e.target.classList.remove('field-error');
    const wrap = e.target.closest('.terms-check');
    if (wrap) wrap.classList.remove('field-error');
});

// إرسال التسجيل
async function submitRegistration() {
    const fullName    = document.getElementById('fullName').value.trim();
    const phone       = document.getElementById('phone').value.trim();
    const idNumber    = document.getElementById('idNumber').value.trim();
    const idDocument  = document.getElementById('idDocument').files[0];
    const iban        = document.getElementById('iban').value.trim();
    const serviceType = document.getElementById('serviceType').value;
    const terms       = document.getElementById('terms').checked;

    // التحقق من الحقول — كل حقل برسالته وتمييزه الخاص (بدل رسالة عامة ما توضح أي حقل ناقص)
    if (!fullName)    { highlightFieldError('fullName');    alert('❌ يرجى إدخال الاسم الكامل'); return; }
    if (!phone)       { highlightFieldError('phone');       alert('❌ يرجى إدخال رقم الجوال'); return; }
    if (phone.length !== 9) { highlightFieldError('phone'); alert('❌ رقم الجوال يجب أن يكون 9 أرقام'); return; }
    if (!idNumber)    { highlightFieldError('idNumber');    alert('❌ يرجى إدخال رقم الهوية أو الإقامة'); return; }
    if (!idDocument)  { highlightFieldError('idDocument');  alert('❌ يرجى إرفاق صورة الهوية أو الإقامة'); return; }
    if (!iban)        { highlightFieldError('iban');        alert('❌ يرجى إدخال رقم IBAN البنكي'); return; }
    if (!serviceType) { highlightFieldError('serviceType'); alert('❌ يرجى اختيار نوع الخدمة'); return; }

    if (!terms) {
        highlightFieldError('terms');
        alert('❌ يرجى الموافقة على الشروط والأحكام');
        return;
    }

    // بيانات التسجيل
    const data = new FormData();
    data.append('fullName', fullName);
    data.append('phone', phone);
    data.append('idNumber', idNumber);
    data.append('idDocument', idDocument);
    data.append('iban', iban);
    data.append('serviceType', serviceType);
    data.append('level', selectedLevel);

    // وثائق مزود السطحة (مركبة حقيقية)
    if (serviceType === 'سطحة') {
        const drivingLicense      = document.getElementById('drivingLicense').files[0];
        const vehicleRegistration = document.getElementById('vehicleRegistration').files[0];
        const transportPermit     = document.getElementById('transportPermit').files[0];

        if (!drivingLicense)      { highlightFieldError('drivingLicense');      alert('❌ يرجى إرفاق رخصة القيادة'); return; }
        if (!vehicleRegistration) { highlightFieldError('vehicleRegistration'); alert('❌ يرجى إرفاق استمارة المركبة'); return; }
        if (!transportPermit)     { highlightFieldError('transportPermit');     alert('❌ يرجى إرفاق تصريح النقل'); return; }

        data.append('drivingLicense', drivingLicense);
        data.append('vehicleRegistration', vehicleRegistration);
        data.append('transportPermit', transportPermit);
    }

    // إضافة بيانات مزود فرد
    if (selectedLevel >= 2) {
        const freelanceNum = document.getElementById('freelanceNum').value.trim();
        const freelanceDoc = document.getElementById('freelanceDoc').files[0];

        if (!freelanceNum) {
            highlightFieldError('freelanceNum');
            alert('❌ يرجى إدخال رقم شهادة العمل الحر');
            return;
        }

        data.append('freelanceNum', freelanceNum);

        if (selectedLevel === 2) {
            if (!freelanceDoc) {
                highlightFieldError('freelanceDoc');
                alert('❌ يرجى إرفاق ملف شهادة العمل الحر');
                return;
            }
            data.append('certificateDocument', freelanceDoc);
        }
    }

    // إضافة بيانات منشأة - شركة
    if (selectedLevel === 3) {
        const crNumber    = document.getElementById('crNumber').value.trim();
        const crDoc       = document.getElementById('crDoc').files[0];
        const companyName = document.getElementById('companyName').value.trim();

        if (!companyName) { highlightFieldError('companyName'); alert('❌ يرجى إدخال اسم الشركة / المنشأة'); return; }
        if (!crNumber)     { highlightFieldError('crNumber');    alert('❌ يرجى إدخال رقم السجل التجاري'); return; }

        if (!crDoc) {
            highlightFieldError('crDoc');
            alert('❌ يرجى إرفاق ملف السجل التجاري');
            return;
        }

        data.append('crNumber', crNumber);
        data.append('companyName', companyName);
        data.append('certificateDocument', crDoc);
    }

    try {
       const response = await fetch(window.location.origin + '/api/providers/register', {
            method: 'POST',
            body:   data
        });

        const result = await response.json();

        if (result.success) {
            showAppAlert(`✅ تم استلام طلبك بنجاح!\n\nسيتم مراجعة بياناتك والتواصل معك خلال 24 ساعة\n\nرقم طلبك: #${result.id}`, () => window.location.href = 'index.html');
        } else {
            alert(`❌ ${result.message}`);
        }

    } catch (error) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// ══ الوضع الليلي ══

function toggleTheme() {
    const body = document.body;
    const btn  = document.getElementById('themeBtn');
    const isDark = body.classList.toggle('dark-mode');

    btn.innerHTML = isDark
        ? '<svg class="icon"><use href="icons.svg#icon-sun"></use></svg>'
        : '<svg class="icon"><use href="icons.svg#icon-moon"></use></svg>';
    localStorage.setItem('yashjub_theme', isDark ? 'dark' : 'light');
}

function loadTheme() {
    const theme = localStorage.getItem('yashjub_theme');
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        const btn = document.getElementById('themeBtn');
        if (btn) btn.innerHTML = '<svg class="icon"><use href="icons.svg#icon-sun"></use></svg>';
    }
}

loadTheme();