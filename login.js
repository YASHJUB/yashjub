// كود تسجيل الدخول في عتاد

const API = window.location.origin + '/api';

let correctOTP = "";
let userType   = "client"; // client أو provider — يُحدَّد تلقائياً من السيرفر بعد التحقق من OTP (راجع verifyOTP)

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
            // ماكو اختيار يدوي للنوع — يُحدَّد تلقائياً من السيرفر (مزوّد معتمد فعلياً أم لا)
            userType = data.isProvider ? 'provider' : 'client';

            // حفظ بيانات المستخدم
            localStorage.setItem('yashjub_phone', phone);
            localStorage.setItem('yashjub_type', userType);

            if (data.avatarPath) localStorage.setItem('yashjub_avatar', data.avatarPath);
            if (data.username)   localStorage.setItem('yashjub_username', data.username);

            if (data.name) {
                // عنده اسم محفوظ مسبقاً
                localStorage.setItem('yashjub_name', data.name);
                showAppAlert("✅ تم تسجيل الدخول بنجاح!\nأهلاً بك في عتاد 👷", redirectAfterLogin);
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

// توجيه بعد اكتمال تسجيل الدخول — الكل يروح للرئيسية مباشرة (ماكو لوحة مزوّد منفصلة يُحوَّل لها تلقائياً)
function redirectAfterLogin() {
    window.location.href = 'index.html';
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