// يشجب - كود التفاعل الكامل

// الخدمات وأوقات الوصول
const services = {
    "وايت ماء": { icon: "🚚", time: "8 دقائق",        type: "فوري"   },
    "سطحة":     { icon: "🚛", time: "12 دقيقة",       type: "فوري"   },
    "بوكلين":   { icon: "🏗️", time: "غداً 9 صباحاً",  type: "مجدول" },
    "حاوية":    { icon: "📦", time: "غداً 11 صباحاً", type: "مجدول" },
    "عمالة":    { icon: "👷", time: "غداً 8 صباحاً",  type: "مجدول" },
}

// تحقق من تسجيل الدخول
function checkLogin() {
    const phone = localStorage.getItem('yashjub_phone');

    if (phone) {
        document.getElementById('userInfo').style.display   = 'none';
        document.getElementById('userLogged').style.display = 'flex';
        document.getElementById('userPhone').textContent    = `👤 +966${phone}`;
    }
}

// الذهاب لصفحة تسجيل الدخول
function goToLogin() {
    const phone = localStorage.getItem('yashjub_phone');
    if (phone) {
        alert(`أنت مسجل دخولك بالفعل 👤\nرقم جوالك: +966${phone}`);
    } else {
        window.location.href = 'login.html';
    }
}

// تسجيل الخروج
function logout() {
    localStorage.removeItem('yashjub_phone');
    location.reload();
}

// طلب خدمة — ينقل لصفحة الطلب
function orderService(name) {
    const phone = localStorage.getItem('yashjub_phone');

    if (!phone) {
        alert("⚠️ يجب تسجيل الدخول أولاً!");
        window.location.href = 'login.html';
        return;
    }

    window.location.href = `order.html?service=${encodeURIComponent(name)}`;
}

// تشغيل التحقق عند فتح الصفحة
checkLogin();