// كود صفحة محفظة المزود

const API = window.location.origin + '/api';

const LEVEL_BADGES = {
    basic:    { label: 'مزود أساسي', icon: 'medal-silver' },
    verified: { label: 'مزود موثق',  icon: 'medal-gold'   },
    business: { label: 'شركة',       icon: 'trophy'       },
};

// تحميل الصفحة
function loadWalletPage() {
    const phone = localStorage.getItem('yashjub_phone');
    const type  = localStorage.getItem('yashjub_type');

    if (!phone || type !== 'provider') {
        showAppAlert('⚠️ هذه الصفحة للمزودين فقط', () => window.location.href = 'login.html');
        return;
    }

    document.getElementById('providerNameSidebar').textContent  = 'مزود خدمة';
    document.getElementById('providerPhoneSidebar').textContent = `+966${phone}`;

    loadProviderIdentity(phone);
    loadWallet(phone);

    loadNotifBell();
    setInterval(loadNotifBell, 60000);
}

// اسم المزود وشارة المستوى بالسايد بار
async function loadProviderIdentity(phone) {
    try {
        const res  = await fetch(`${API}/providers`);
        const data = await res.json();
        if (!data.success) return;

        const me = data.providers.find(p => p.phone === phone);
        if (!me) return;

        document.getElementById('providerNameSidebar').textContent = me.name;

        const levelBadge = LEVEL_BADGES[me.level] || LEVEL_BADGES.verified;
        document.getElementById('sidebarProviderBadge').innerHTML =
            `<svg class="icon"><use href="icons.svg#icon-${levelBadge.icon}"></use></svg> ${levelBadge.label}`;
    } catch (e) {}
}

// تحميل بيانات المحفظة من طلبات المزوّد الحقيقية
async function loadWallet(phone) {
    try {
        const res  = await fetch(`${API}/orders/provider/${phone}`);
        const data = await res.json();
        if (!data.success) return;

        const orders    = data.orders;
        const completed = orders.filter(o => o.status === 'completed');
        const pending   = orders.filter(o => o.status === 'pending');

        const totalEarned   = completed.reduce((sum, o) => sum + (o.price - o.commission), 0);
        const pendingAmount = pending.reduce((sum, o) => sum + o.price, 0);

        document.getElementById('walletBalance').textContent   = `${totalEarned.toLocaleString()} ريال`;
        document.getElementById('walletTotal').textContent     = totalEarned.toLocaleString();
        document.getElementById('walletPending').textContent   = pendingAmount.toLocaleString();
        document.getElementById('walletWithdrawn').textContent = '0';
    } catch (e) {
        console.log('خطأ في تحميل المحفظة');
    }
}

// طلب سحب
function requestWithdraw() {
    const balance = document.getElementById('walletBalance').textContent;
    alert(`💳 طلب سحب\n\nالرصيد المتاح: ${balance}\n\nسيتم تحويل المبلغ لحسابك البنكي خلال 24-72 ساعة`);
}

// تسجيل الخروج
function providerLogout() {
    localStorage.removeItem('yashjub_phone');
    localStorage.removeItem('yashjub_type');
    localStorage.removeItem('yashjub_name');
    window.location.href = 'index.html';
}

// السايد بار
function toggleSidebar() {
    document.getElementById('appSidebar').classList.toggle('active');
    document.getElementById('sidebarOverlay').classList.toggle('active');
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

// تشغيل
loadWalletPage();
loadTheme();
