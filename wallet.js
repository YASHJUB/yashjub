// كود صفحة محفظة المزود

const API = window.location.origin + '/api';

const LEVEL_BADGES = {
    basic:    { label: 'مزود أساسي', icon: 'medal-silver' },
    verified: { label: 'موثق',       icon: 'medal-gold'   },
    business: { label: 'شركة',       icon: 'trophy'       },
};

// تحميل الصفحة — يتحقق أولاً من النظام النشط (paid/ads) قبل تقرير شروط الدخول ومحتوى الصفحة
async function loadWalletPage() {
    const phone = localStorage.getItem('yashjub_phone');
    const type  = localStorage.getItem('yashjub_type');

    let isAdsMode = false;
    try {
        const res  = await fetch(`${API}/settings/active-system`);
        const data = await res.json();
        isAdsMode = data.success && data.activeSystem === 'ads';
    } catch (e) {}

    if (isAdsMode) {
        // بوضع الإعلانات يكفي إن المستخدم مسجّل دخوله (أي نوع) — ماكو مفهوم "مزوّد" حصري هنا
        if (!phone) {
            showAppAlert('⚠️ يجب تسجيل الدخول أولاً', () => window.location.href = 'login.html');
            return;
        }
        switchWalletToAdsMode(phone);
        return;
    }

    // وضع النظام المدفوع (أو تعذّر الاتصال بالسيرفر) — نفس السلوك الأصلي بدون أي تغيير
    if (!phone || type !== 'provider') {
        showAppAlert('⚠️ هذه الصفحة للمزودين فقط', () => window.location.href = 'login.html');
        return;
    }

    document.getElementById('providerNameSidebar').textContent  = 'مزود خدمة';
    document.getElementById('providerPhoneSidebar').textContent = `+966${phone}`;
    renderSidebarAvatar();

    loadProviderIdentity(phone);
    loadWallet(phone);

    loadNotifBell();
    setInterval(loadNotifBell, 60000);
}

// تحويل محفظتي لمحفظة العملات الذهبية بوضع الإعلانات — نفس سايد بار index.html/provider.html الموحّد، مع تعليم "محفظتي" نشطة
function switchWalletToAdsMode(phone) {
    document.getElementById('walletSection').style.display      = 'none';
    document.getElementById('coinsWalletSection').style.display = 'block';

    const savedName = localStorage.getItem('yashjub_name');
    document.getElementById('providerNameSidebar').textContent  = savedName || 'مستخدم غَوْث';
    document.getElementById('providerPhoneSidebar').textContent = `+966${phone}`;
    renderSidebarAvatar();
    const badge = document.getElementById('sidebarProviderBadge');
    if (badge) badge.style.display = 'none';

    const sidebarMenu = document.getElementById('sidebarMenu');
    if (sidebarMenu) sidebarMenu.innerHTML = `
        <a class="sidebar-link" href="index.html"><span><svg class="icon"><use href="icons.svg#icon-home"></use></svg></span> الرئيسية</a>
        <a class="sidebar-link" href="provider.html#adsSection"><span><svg class="icon"><use href="icons.svg#icon-plus"></use></svg></span> انشر إعلانك</a>
        <a class="sidebar-link" href="profile.html"><span><svg class="icon"><use href="icons.svg#icon-user"></use></svg></span> حسابي</a>
        <a class="sidebar-link" href="provider.html#adsSection"><span><svg class="icon"><use href="icons.svg#icon-broadcast"></use></svg></span> إعلاناتي</a>
        <a class="sidebar-link" href="favorites.html"><span><svg class="icon"><use href="icons.svg#icon-heart"></use></svg></span> قائمة المفضلة</a>
        <a class="sidebar-link active" href="wallet.html"><span><svg class="icon"><use href="icons.svg#icon-card"></use></svg></span> محفظتي</a>
        <a class="sidebar-link" href="fees.html"><span><svg class="icon"><use href="icons.svg#icon-calculator"></use></svg></span> حاسبة الرسوم والدفع</a>
        <a class="sidebar-link" href="messages.html"><span><svg class="icon"><use href="icons.svg#icon-chat"></use></svg></span> الرسائل <span class="sidebar-badge" id="messagesBadge" style="display:none">0</span></a>
        <div class="sidebar-divider"></div>
        <a class="sidebar-link" href="about.html"><span><svg class="icon"><use href="icons.svg#icon-info"></use></svg></span> من نحن</a>
        <a class="sidebar-link" href="contact.html"><span><svg class="icon"><use href="icons.svg#icon-phone-call"></use></svg></span> تواصل معنا</a>
        <a class="sidebar-link" href="terms.html"><span><svg class="icon"><use href="icons.svg#icon-document"></use></svg></span> الشروط والأحكام</a>
    `;
    loadMessagesBadge();
    setInterval(loadMessagesBadge, 30000);

    loadCoinsBalance(phone);
    loadCoinsPackages();
    loadCoinsTransactions(phone);

    loadNotifBell();
    setInterval(loadNotifBell, 60000);
}

// ══ محفظة العملات الذهبية ══

let coinsPackages  = [];
let selectedPackageId = null;

async function loadCoinsBalance(phone) {
    try {
        const res  = await fetch(`${API}/coins/balance/${phone}`);
        const data = await res.json();
        if (data.success) {
            document.getElementById('coinsBalanceNum').textContent = data.balance.toLocaleString('en-US');
        }
    } catch (e) {}
}

async function loadCoinsPackages() {
    try {
        const res  = await fetch(`${API}/coins/packages`);
        const data = await res.json();
        if (data.success) {
            coinsPackages = data.packages;
            renderCoinsPackages();
        }
    } catch (e) {}
}

function renderCoinsPackages() {
    const grid = document.getElementById('coinsPackagesGrid');
    grid.innerHTML = coinsPackages.map(p => `
        <div class="coins-package-card ${p.id === selectedPackageId ? 'selected' : ''}" onclick="selectCoinsPackage(${p.id})">
            ${p.is_popular ? '<div class="coins-package-popular-badge">الأكثر طلباً 🔥</div>' : ''}
            <div class="coins-package-icon"><svg class="icon"><use href="icons.svg#icon-coin"></use></svg></div>
            <div class="coins-package-coins">${p.coins.toLocaleString('en-US')}</div>
            ${p.bonus_coins ? `<div class="coins-package-bonus">+ ${p.bonus_coins.toLocaleString('en-US')} مجاناً</div>` : ''}
            <div class="coins-package-price">${p.price.toLocaleString('en-US')} ريال</div>
        </div>
    `).join('');
}

function selectCoinsPackage(id) {
    selectedPackageId = id;
    renderCoinsPackages();

    const btn = document.getElementById('coinsChargeBtn');
    btn.disabled = false;
    btn.classList.add('active');
}

function openCoinsPaymentModal() {
    if (!selectedPackageId) return;
    document.getElementById('coinsPaymentModalOverlay').style.display = 'flex';
}

function closeCoinsPaymentModal() {
    document.getElementById('coinsPaymentModalOverlay').style.display = 'none';
}

// ماكو بوابة دفع حقيقية بالمشروع أصلاً بعد — نفس قيد "حاسبة الرسوم والدفع" الموثّق بالمشروع
function coinsComingSoon() {
    closeCoinsPaymentModal();
    showAppAlert('📱 سيتم تفعيل الدفع قريباً، تواصل معنا على واتساب لإتمام الشراء', () => {
        window.open('https://wa.me/966500000000', '_blank');
    });
}

async function loadCoinsTransactions(phone) {
    try {
        const res  = await fetch(`${API}/coins/transactions/${phone}`);
        const data = await res.json();
        if (data.success) renderCoinsTransactions(data.transactions);
    } catch (e) {}
}

const COINS_TX_META = {
    purchase: { icon: 'card', bg: 'rgba(16,185,129,0.12)',  color: '#10B981' },
    spend:    { icon: 'star', bg: 'rgba(245,197,24,0.15)',  color: '#92700A' },
    bonus:    { icon: 'gift', bg: 'rgba(147,51,234,0.12)',  color: '#9333EA' },
};

function renderCoinsTransactions(transactions) {
    const list = document.getElementById('coinsTransactionsList');

    if (!transactions.length) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><svg class="icon"><use href="icons.svg#icon-coin"></use></svg></div>
                <div class="empty-title">لا يوجد معاملات بعد</div>
            </div>`;
        return;
    }

    list.innerHTML = transactions.map(t => {
        const meta   = COINS_TX_META[t.type] || COINS_TX_META.purchase;
        const isPlus = t.type !== 'spend';
        const date   = new Date(t.created_at.replace(' ', 'T') + 'Z').toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });

        return `
            <div class="coins-transaction-item">
                <div class="coins-transaction-icon" style="background:${meta.bg};color:${meta.color}">
                    <svg class="icon"><use href="icons.svg#icon-${meta.icon}"></use></svg>
                </div>
                <div style="flex:1">
                    <div class="coins-transaction-desc">${t.description || ''}</div>
                    <div class="coins-transaction-date">${date}</div>
                </div>
                <div class="coins-transaction-amount" style="color:${isPlus ? '#10B981' : '#EF4444'}">
                    ${isPlus ? '+' : '-'}${t.amount.toLocaleString('en-US')}
                </div>
            </div>
        `;
    }).join('');
}

// badge "الرسائل" بالسايد بار — مجموع غير المقروء بكل محادثات المستخدم (راجع نظام الرسائل الداخلية)
async function loadMessagesBadge() {
    const phone = localStorage.getItem('yashjub_phone');
    if (!phone) return;

    try {
        const res  = await fetch(`${API}/conversations/${phone}`);
        const data = await res.json();
        if (!data.success) return;

        const totalUnread = data.conversations.reduce((sum, c) => sum + (c.my_unread_count || 0), 0);
        const badge = document.getElementById('messagesBadge');
        if (!badge) return;
        badge.textContent   = totalUnread;
        badge.style.display = totalUnread > 0 ? 'inline-block' : 'none';
    } catch (e) {}
}

// الصورة الشخصية (أفاتار) بالسايد بار — موحّدة للعميل والمزوّد (راجع "الصورة الشخصية" بـprofile.js)
function renderSidebarAvatar() {
    const avatarPath = localStorage.getItem('yashjub_avatar');
    const el = document.getElementById('sidebarUserIcon');
    if (el && avatarPath) el.innerHTML = `<img src="${avatarPath}" class="avatar-img" alt="">`;
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
    localStorage.removeItem('yashjub_avatar');
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
