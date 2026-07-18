// كود تسجيل الدخول — متصل بالسيرفر

const API = window.location.origin + '/api';

async function sendOTP() {
    const phone = document.getElementById('phone').value;

    if (phone.length !== 9) {
        alert("❌ رقم الجوال يجب أن يكون 9 أرقام");
        return;
    }

    try {
        // إرسال الطلب للسيرفر
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
            localStorage.setItem('yashjub_phone', phone);
            alert("✅ تم تسجيل الدخول بنجاح!\nأهلاً بك في يشجب 👷");
            window.location.href = 'index.html';
        } else {
            alert(`❌ ${data.message}`);
        }

    } catch (error) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}