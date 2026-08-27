// يشجب - كود التفاعل الكامل

const services = {
    "وايت ماء": { icon: "truck", time: "8 دقائق",        type: "فوري"   },
    "سطحة":     { icon: "tow-truck", time: "12 دقيقة",       type: "فوري"   },
    "حاوية":    { icon: "box", time: "غداً 11 صباحاً", type: "مجدول" },
}

// تحقق من تسجيل الدخول
function checkLogin() {
    const phone = localStorage.getItem('yashjub_phone');
    const type  = localStorage.getItem('yashjub_type') || 'client';

    if (phone) {
        // إخفاء زر دخول
        const notLogged = document.getElementById('userNotLogged');
        if (notLogged) notLogged.style.display = 'none';

        // تحديث السايد بار
        const savedName = localStorage.getItem('yashjub_name');
        document.getElementById('sidebarPhone').textContent    = `+966${phone}`;
        document.getElementById('sidebarUserName') && (document.getElementById('sidebarUserName').textContent = savedName || (type === 'provider' ? 'مزود خدمة' : 'عميل'));
        document.getElementById('sidebarLoginBtn').style.display  = 'none';
        document.getElementById('sidebarLogoutBtn').style.display = 'block';

        // إظهار لوحة المزود إذا كان مزوداً
        if (type === 'provider') {
            const providerLink = document.getElementById('providerLink');
            if (providerLink) providerLink.style.display = 'flex';
        }
    }
}

// فتح/إغلاق السايد بار
function toggleSidebar() {
    const sidebar = document.getElementById('appSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

// الذهاب لصفحة تسجيل الدخول
function goToLogin() {
    const phone = localStorage.getItem('yashjub_phone');
    if (phone) {
        window.location.href = 'profile.html';
    } else {
        window.location.href = 'login.html';
    }
}

// تسجيل الخروج
function logout() {
    localStorage.removeItem('yashjub_phone');
    localStorage.removeItem('yashjub_type');
    localStorage.removeItem('yashjub_name');
    location.reload();
}

// طلب خدمة
function orderService(name) {
    const phone = localStorage.getItem('yashjub_phone');

    if (!phone) {
        alert("⚠️ يجب تسجيل الدخول أولاً!");
        window.location.href = 'login.html';
        return;
    }

    if (name === 'حاوية') {
        window.location.href = 'container-location.html';
        return;
    }

    window.location.href = `order.html?service=${encodeURIComponent(name)}`;
}

// إظهار/إخفاء قائمة المعدات الثقيلة
function showHeavyEquipment() {
    const panel  = document.getElementById('heavyEquipmentPanel');
    const isOpen = panel.style.display === 'block';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// تشغيل التحقق عند فتح الصفحة
checkLogin();// الوضع الليلي
function toggleTheme() {
    const body = document.body;
    const btn  = document.getElementById('themeBtn');
    const isDark = body.classList.toggle('dark-mode');

    btn.innerHTML = isDark
        ? '<svg class="icon"><use href="icons.svg#icon-sun"></use></svg>'
        : '<svg class="icon"><use href="icons.svg#icon-moon"></use></svg>';
    localStorage.setItem('yashjub_theme', isDark ? 'dark' : 'light');
}

// تطبيق الثيم المحفوظ
function loadTheme() {
    const theme = localStorage.getItem('yashjub_theme');
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        const btn = document.getElementById('themeBtn');
        if (btn) btn.innerHTML = '<svg class="icon"><use href="icons.svg#icon-sun"></use></svg>';
    }
}

// تشغيل عند فتح الصفحة
loadTheme();