// كود تسجيل المزود في يشجب

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
        1: '📝 تسجيل المستوى الأول — مزود أساسي',
        2: '📝 تسجيل المستوى الثاني — مزود موثق',
        3: '📝 تسجيل المستوى الثالث — شركة / منشأة'
    };
    document.getElementById('regFormTitle').textContent = titles[level];

    // إخفاء / إظهار الحقول
    document.getElementById('level2Fields').style.display = level >= 2 ? 'block' : 'none';
    document.getElementById('level3Fields').style.display = level === 3 ? 'block' : 'none';

    // تمرير للنموذج
    document.getElementById('regFormSection').scrollIntoView({ behavior: 'smooth' });
}

// إرسال التسجيل
async function submitRegistration() {
    const fullName    = document.getElementById('fullName').value;
    const phone       = document.getElementById('phone').value;
    const idNumber    = document.getElementById('idNumber').value;
    const iban        = document.getElementById('iban').value;
    const serviceType = document.getElementById('serviceType').value;
    const terms       = document.getElementById('terms').checked;

    // التحقق من الحقول
    if (!fullName || !phone || !idNumber || !iban || !serviceType) {
        alert('❌ يرجى تعبئة جميع الحقول المطلوبة');
        return;
    }

    if (phone.length !== 9) {
        alert('❌ رقم الجوال يجب أن يكون 9 أرقام');
        return;
    }

    if (!terms) {
        alert('❌ يرجى الموافقة على الشروط والأحكام');
        return;
    }

    // بيانات التسجيل
    const data = {
        fullName,
        phone,
        idNumber,
        iban,
        serviceType,
        level: selectedLevel,
    };

    // إضافة بيانات المستوى الثاني
    if (selectedLevel >= 2) {
        data.freelanceNum = document.getElementById('freelanceNum').value;
        if (!data.freelanceNum) {
            alert('❌ يرجى إدخال رقم شهادة العمل الحر');
            return;
        }
    }

    // إضافة بيانات المستوى الثالث
    if (selectedLevel === 3) {
        data.crNumber    = document.getElementById('crNumber').value;
        data.companyName = document.getElementById('companyName').value;
        if (!data.crNumber || !data.companyName) {
            alert('❌ يرجى إدخال بيانات الشركة');
            return;
        }
    }

    try {
       const response = await fetch(window.location.origin + '/api/providers/register', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            alert(`✅ تم استلام طلبك بنجاح!\n\nسيتم مراجعة بياناتك والتواصل معك خلال 24 ساعة\n\nرقم طلبك: #${result.id}`);
            window.location.href = 'index.html';
        } else {
            alert(`❌ ${result.message}`);
        }

    } catch (error) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}