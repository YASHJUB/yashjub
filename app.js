// يشجب - كود التفاعل الكامل

const API = window.location.origin + '/api';

const SERVICE_BADGE_LABELS = { instant: 'فوري', scheduled: 'مجدول', coming: 'قريباً' };

// تحميل قائمة الخدمات من لوحة الإدارة وعرضها بالصفحة الرئيسية
async function loadServices() {
    const container = document.getElementById('servicesList');
    if (!container) return;

    try {
        const res  = await fetch(`${API}/services/active`);
        const data = await res.json();

        if (!data.success || !data.services.length) return;

        container.innerHTML = data.services.map(s => {
            const badgeLabel = SERVICE_BADGE_LABELS[s.badge_type] || s.badge_type;
            const soonClass  = s.action_type === 'panel' ? ' soon' : '';
            const onclick    = s.action_type === 'panel'
                ? 'showHeavyEquipment()'
                : `orderService('${s.name.replace(/'/g, "\\'")}', '${s.action_type}')`;

            return `
                <div class="service-row${soonClass}" onclick="${onclick}">
                    <div class="service-row-right">
                        <div class="service-row-icon"><svg class="icon"><use href="icons.svg#icon-${s.icon}"></use></svg></div>
                        <div class="service-row-info">
                            <div class="service-row-name">${s.name}</div>
                            <div class="service-row-desc">${s.description || ''}</div>
                        </div>
                    </div>
                    <div class="service-row-left">
                        <span class="service-row-type ${s.badge_type}">${badgeLabel}</span>
                        <span class="service-row-arrow">←</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        // تعذّر التحميل — تبقى الخدمات الأربع الثابتة بالـ HTML كما هي
    }
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

        // إظهار جرس الإشعارات وتحميلها
        const bellWrap = document.getElementById('notifBellWrap');
        if (bellWrap) {
            bellWrap.style.display = 'block';
            loadNotifBell();
            setInterval(loadNotifBell, 60000);
        }
    }
}

// ══ جرس الإشعارات ══

const NOTIF_TYPE_ICONS = {
    urgent: { icon: 'siren',    bg: 'rgba(239,68,68,0.1)',   color: '#EF4444' },
    alert:  { icon: 'warning',  bg: 'rgba(245,158,11,0.1)',  color: '#F59E0B' },
    update: { icon: 'bell',     bg: 'rgba(16,185,129,0.1)',  color: '#10B981' },
    offer:  { icon: 'confetti', bg: 'rgba(245,197,24,0.15)', color: '#92700A' },
};

async function loadNotifBell() {
    const phone = localStorage.getItem('yashjub_phone');
    if (!phone) return;

    try {
        const res  = await fetch(`${API}/notifications/${phone}`);
        const data = await res.json();
        if (!data.success) return;

        const unreadCount = data.notifications.filter(n => !n.is_read).length;
        const badge = document.getElementById('notifBellBadge');
        badge.textContent   = unreadCount;
        badge.style.display = unreadCount > 0 ? 'flex' : 'none';

        renderNotifDropdown(data.notifications.slice(0, 5));
    } catch (e) {}
}

function renderNotifDropdown(notifications) {
    const list = document.getElementById('notifDropdownList');

    if (!notifications.length) {
        list.innerHTML = '<div class="notif-dropdown-empty">لا توجد إشعارات</div>';
        return;
    }

    list.innerHTML = notifications.map(n => {
        const meta = NOTIF_TYPE_ICONS[n.type] || NOTIF_TYPE_ICONS.update;
        return `
            <div class="notif-dropdown-item ${n.is_read ? '' : 'unread'}" onclick="clickNotifItem(${n.id})">
                <div class="notif-dropdown-icon" style="background:${meta.bg};color:${meta.color}">
                    <svg class="icon"><use href="icons.svg#icon-${meta.icon}"></use></svg>
                </div>
                <div>
                    <div class="notif-dropdown-title">${n.title}</div>
                    <div class="notif-dropdown-message">${n.message}</div>
                </div>
            </div>
        `;
    }).join('');
}

function toggleNotifDropdown() {
    const dropdown = document.getElementById('notifDropdown');
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

async function clickNotifItem(id) {
    try {
        await fetch(`${API}/notifications/${id}/read`, { method: 'PUT' });
        loadNotifBell();
    } catch (e) {}
    window.location.href = 'profile.html#notifications';
}

// إغلاق قائمة الإشعارات عند الضغط خارجها
document.addEventListener('click', (e) => {
    const wrap = document.getElementById('notifBellWrap');
    if (wrap && !wrap.contains(e.target)) {
        const dropdown = document.getElementById('notifDropdown');
        if (dropdown) dropdown.style.display = 'none';
    }
});

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
function orderService(name, actionType) {
    const phone = localStorage.getItem('yashjub_phone');

    if (!phone) {
        alert("⚠️ يجب تسجيل الدخول أولاً!");
        window.location.href = 'login.html';
        return;
    }

    if (actionType === 'container' || (!actionType && name === 'حاوية')) {
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
checkLogin();
loadServices();
// الوضع الليلي
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