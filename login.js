// كود تسجيل الدخول في يشجب

const API = window.location.origin + '/api';

let correctOTP = "";
let userType   = "client"; // client أو provider

// اختيار نوع المستخدم
function selectType(type) {
    userType = type;

    document.getElementById('clientTab').classList.toggle('active', type === 'client');
    document.getElementById('providerTab').classList.toggle('active', type === 'provider');
}

// إرسال OTP
async function sendOTP() {
    const phone = document.getElementById('phone').value;

    if (phone.length !== 9) {
        alert("❌ رقم الجوال يجب أن يكون 9 أرقام");
        return;
    }

    try {
        const response = await fetch(`${API}/auth/send-otp`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ phone })
        });

        const data = await response.json();

        if (data.success) {
            alert(`📱 تم إرسال رمز التحقق:\n\n${data.otp}\n\n(في النسخة الحقيقية يُرسل عبر SMS)`);
            document.getElementById('otpSection').style.display = 'block';
        } else {
            alert(`❌ ${data.message}`);
        }

    } catch (error) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// التحقق من OTP
async function verifyOTP() {
    const phone = document.getElementById('phone').value;
    const otp   = document.getElementById('otp').value;

    try {
        const response = await fetch(`${API}/auth/verify-otp`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ phone, otp })
        });

        const data = await response.json();

        if (data.success) {
            // حفظ بيانات المستخدم
            localStorage.setItem('yashjub_phone', phone);
            localStorage.setItem('yashjub_type', userType);

            if (data.name) {
                // عنده اسم محفوظ مسبقاً
                localStorage.setItem('yashjub_name', data.name);
                alert("✅ تم تسجيل الدخول بنجاح!\nأهلاً بك في يشجب 👷");
                redirectAfterLogin();
            } else {
                // أول مرة يدخل — لازم يحدد اسمه قبل ما يكمل
                document.getElementById('namePopupOverlay').style.display = 'flex';
            }

        } else {
            alert(`❌ ${data.message}`);
        }

    } catch (error) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// حفظ اسم المستخدم (نافذة الترحيب)
async function saveUserName() {
    const name  = document.getElementById('nameInput').value.trim();
    const phone = localStorage.getItem('yashjub_phone');

    if (!name) {
        alert('❌ يرجى إدخال اسمك للمتابعة');
        return;
    }

    try {
        const response = await fetch(`${API}/users/${phone}/name`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ name })
        });

        const data = await response.json();

        if (data.success) {
            localStorage.setItem('yashjub_name', data.name);
            document.getElementById('namePopupOverlay').style.display = 'none';
            redirectAfterLogin();
        } else {
            alert(`❌ ${data.message}`);
        }

    } catch (error) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// توجيه حسب نوع المستخدم بعد اكتمال تسجيل الدخول
function redirectAfterLogin() {
    if (userType === 'provider') {
        window.location.href = 'provider.html';
    } else {
        window.location.href = 'index.html';
    }
}