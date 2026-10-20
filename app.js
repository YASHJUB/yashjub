// غَوْث - كود التفاعل الكامل

const API = window.location.origin + '/api';

const SERVICE_BADGE_LABELS = { instant: 'فوري', scheduled: 'مجدول', coming: 'قريباً' };

let activeOrderBarInterval = null;

const ACTIVE_ORDER_BAR_STATUS = {
    pending:  { text: '🔍 جاري البحث عن مزود...',            progress: 25 },
    accepted: { text: '✅ تم قبول طلبك — المزود في الطريق',  progress: 60 },
    arrived:  { text: '📍 المزود وصل لموقعك',                progress: 90 },
};

// شريط تتبع الطلب النشط — يتحدّث كل 30 ثانية
function startActiveOrderBar() {
    checkActiveOrderBar();
    activeOrderBarInterval = setInterval(checkActiveOrderBar, 30000);
}

function checkActiveOrderBar() {
    const phone     = localStorage.getItem('yashjub_phone');
    const orderData = localStorage.getItem('yashjub_order');

    if (!phone || !orderData) {
        hideActiveOrderBar();
        return;
    }

    let localOrder;
    try {
        localOrder = JSON.parse(orderData);
    } catch (e) {
        hideActiveOrderBar();
        return;
    }

    fetchActiveOrderStatus(localOrder);
}

async function fetchActiveOrderStatus(localOrder) {
    try {
        const res  = await fetch(`${API}/orders/${localOrder.id}`);
        const data = await res.json();

        if (!data.success) {
            hideActiveOrderBar();
            return;
        }

        const order = data.order;

        if (order.status === 'completed' || order.status === 'cancelled') {
            localStorage.removeItem('yashjub_order');
            hideActiveOrderBar();
            return;
        }

        showActiveOrderBar(order, localOrder.icon);
    } catch (e) {
        hideActiveOrderBar();
    }
}

function showActiveOrderBar(order, icon) {
    const bar  = document.getElementById('activeOrderBar');
    const meta = ACTIVE_ORDER_BAR_STATUS[order.status];
    if (!bar || !meta) {
        hideActiveOrderBar();
        return;
    }

    document.getElementById('activeOrderIconUse').setAttribute('href', `icons.svg#icon-${icon || 'truck'}`);
    document.getElementById('activeOrderService').textContent = order.service;
    document.getElementById('activeOrderNumber').textContent  = `#${order.id}`;
    document.getElementById('activeOrderStatus').textContent  = meta.text;
    document.getElementById('activeOrderProgressFill').style.width = `${meta.progress}%`;

    bar.style.display = 'flex';
}

function hideActiveOrderBar() {
    const bar = document.getElementById('activeOrderBar');
    if (bar) bar.style.display = 'none';
}

function goToActiveOrderTracking() {
    window.location.href = 'tracking.html';
}

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

// ══ التبديل بين نظام الطلبات المدفوعة ونظام الإعلانات (منصة غوث معاهدة) ══

let currentActiveSystem = 'paid';

const AD_CATEGORIES      = [
    { name: 'سطحة',       icon: 'tow-truck' },
    { name: 'حاوية',      icon: 'box'       },
    { name: 'معدات ثقيلة', icon: 'crane'     },
];
const AD_CATEGORY_ICONS = { 'سطحة': 'tow-truck', 'حاوية': 'box', 'معدات ثقيلة': 'crane' };

// يحدد أي نظام نشط حالياً ويبني الصفحة الرئيسية على أساسه — يُستدعى بدل loadServices() مباشرة
async function checkActiveSystem() {
    try {
        const res  = await fetch(`${API}/settings/active-system`);
        const data = await res.json();
        if (data.success) currentActiveSystem = data.activeSystem;
    } catch (e) {}

    // المزوّد مقفل على لوحة المزود فقط بوضع النظام المدفوع — بوضع الإعلانات يتصفح الرئيسية كأي مستخدم (راح يدير إعلاناته من "إعلاناتي" بدل لوحة منفصلة)
    const type = localStorage.getItem('yashjub_type') || 'client';
    if (type === 'provider' && currentActiveSystem !== 'ads') {
        window.location.href = 'provider.html';
        return;
    }

    applyLoginUI();

    if (currentActiveSystem === 'ads') {
        switchToAdsMode();
    } else {
        loadServices();
    }
}

// تحويل الصفحة الرئيسية لواجهة الإعلانات (أقسام الإعلانات بدل الخدمات، إخفاء كيف يعمل/لماذا غوث، أحدث الإعلانات)
async function switchToAdsMode() {
    const howSection   = document.querySelector('.how-section');
    const whySection   = document.querySelector('.why-section');
    const heroSection  = document.getElementById('heroSection');
    const statsSection = document.getElementById('statsSection');
    if (howSection) howSection.style.display = 'none';
    if (whySection) whySection.style.display = 'none';
    if (heroSection) heroSection.style.display = 'none';
    if (statsSection) statsSection.style.display = 'none';

    // سايد بار موحّد بوضع الإعلانات — نفس البنية المستخدمة بـ provider.html ("إعلاناتي") بالضبط
    const sidebarMenu = document.getElementById('sidebarMenu');
    if (sidebarMenu) sidebarMenu.innerHTML = `
        <a class="sidebar-link" href="index.html"><span><svg class="icon"><use href="icons.svg#icon-home"></use></svg></span> الرئيسية</a>
        <a class="sidebar-link" href="provider.html#adsSection"><span><svg class="icon"><use href="icons.svg#icon-plus"></use></svg></span> انشر إعلانك</a>
        <a class="sidebar-link" href="profile.html"><span><svg class="icon"><use href="icons.svg#icon-user"></use></svg></span> حسابي</a>
        <a class="sidebar-link" href="provider.html#adsSection"><span><svg class="icon"><use href="icons.svg#icon-broadcast"></use></svg></span> إعلاناتي</a>
        <a class="sidebar-link" href="wallet.html"><span><svg class="icon"><use href="icons.svg#icon-card"></use></svg></span> محفظتي</a>
        <a class="sidebar-link" href="fees.html"><span><svg class="icon"><use href="icons.svg#icon-calculator"></use></svg></span> حاسبة الرسوم والدفع</a>
        <a class="sidebar-link" href="messages.html"><span><svg class="icon"><use href="icons.svg#icon-chat"></use></svg></span> الرسائل <span class="sidebar-badge" id="messagesBadge" style="display:none">0</span></a>
        <div class="sidebar-divider"></div>
        <a class="sidebar-link" href="about.html"><span><svg class="icon"><use href="icons.svg#icon-info"></use></svg></span> من نحن</a>
        <a class="sidebar-link" href="contact.html"><span><svg class="icon"><use href="icons.svg#icon-phone-call"></use></svg></span> تواصل معنا</a>
        <a class="sidebar-link" href="terms.html"><span><svg class="icon"><use href="icons.svg#icon-document"></use></svg></span> الشروط والأحكام</a>
    `;
    loadMessagesBadge();
    setInterval(loadMessagesBadge, 30000);

    const desc    = document.getElementById('providerSectionDesc');
    const bens    = document.getElementById('providerSectionBenefits');
    const btn     = document.getElementById('providerSectionBtn');
    const visual  = document.querySelector('.provider-visual');
    const badge   = document.querySelector('.provider-badge');
    if (desc) desc.textContent = 'انشر إعلانك وتواصل مباشرة مع العملاء';
    if (bens) bens.style.display = 'none';
    if (badge) badge.style.display = 'none';
    if (btn) btn.innerHTML = 'انشر إعلانك الآن <svg class="icon"><use href="icons.svg#icon-worker"></use></svg>';
    if (visual && btn) visual.appendChild(btn); // نقل الزر لمكان دائرة "+500 مزود نشط" (يسار النص بوضع RTL)

    try {
        const res  = await fetch(`${API}/ads`);
        const data = await res.json();
        if (!data.success) return;

        const counts = {};
        data.ads.forEach(ad => { counts[ad.category] = (counts[ad.category] || 0) + 1; });
        renderAdCategoryRows(counts);

        const latest = [...data.ads].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6);
        if (latest.length) {
            document.getElementById('latestAdsGrid').innerHTML = latest.map(renderAdCard).join('');
            document.getElementById('latestAdsSection').style.display = 'block';
        }
    } catch (e) {}
}

// صفوف أقسام الإعلانات (تحل محل قائمة الخدمات بالصفحة الرئيسية بوضع الإعلانات)
function renderAdCategoryRows(counts) {
    const container = document.getElementById('servicesList');
    if (!container) return;

    container.innerHTML = AD_CATEGORIES.map(c => `
        <div class="service-row" onclick="window.location.href='ads.html?category=${encodeURIComponent(c.name)}'">
            <div class="service-row-right">
                <div class="service-row-icon"><svg class="icon"><use href="icons.svg#icon-${c.icon}"></use></svg></div>
                <div class="service-row-info">
                    <div class="service-row-name">${c.name}</div>
                </div>
            </div>
            <div class="service-row-left">
                <span class="service-row-count">${counts[c.name] || 0} إعلان</span>
                <span class="service-row-arrow">←</span>
            </div>
        </div>
    `).join('');
}

// بطاقة إعلان مشتركة (تُستخدم بالرئيسية وبصفحة ads.html) — صورة الإعلان الأولى خلفية البطاقة مع تظليل داكن، أو خلفية سوداء لو بدون صور
function renderAdCard(ad) {
    const icon = AD_CATEGORY_ICONS[ad.category] || 'wrench';
    let images = [];
    try { images = JSON.parse(ad.images || '[]'); } catch (e) { images = []; }
    const hasImage = images.length > 0;
    const bgStyle = hasImage ? `background-image:url('${images[0]}')` : '';

    return `
        <div class="ad-card ${ad.is_featured ? 'featured' : ''}" style="${bgStyle}" onclick="window.location.href='ad-details.html?id=${ad.id}'">
            ${hasImage ? '<div class="ad-card-overlay"></div>' : ''}
            ${ad.is_featured ? '<div class="ad-card-featured-badge"><svg class="icon"><use href="icons.svg#icon-star"></use></svg> متصدر</div>' : ''}
            <div class="ad-card-content">
                <div class="ad-card-category"><svg class="icon"><use href="icons.svg#icon-${icon}"></use></svg> ${ad.title}</div>
                <div class="ad-card-provider">${ad.category} — ${ad.provider_name || 'مزوّد'}</div>
                <div class="ad-card-meta">
                    <span class="ad-card-rating"><svg class="icon"><use href="icons.svg#icon-star"></use></svg> ${ad.avg_rating || '—'} (${ad.reviews_count || 0} تقييم)</span>
                    <span><svg class="icon"><use href="icons.svg#icon-eye"></use></svg> ${ad.views_count} مشاهدة</span>
                </div>
                <div class="ad-card-location"><svg class="icon"><use href="icons.svg#icon-pin"></use></svg> ${ad.city}${ad.district ? ' — ' + ad.district : ''}</div>
                <div class="ad-card-price"><svg class="icon"><use href="icons.svg#icon-cash"></use></svg> من ${ad.price_from} ريال</div>
                <div class="ad-card-actions" onclick="event.stopPropagation()">
                    <a class="btn-call" href="tel:+966${ad.provider_phone}"><svg class="icon"><use href="icons.svg#icon-phone-call"></use></svg> اتصال</a>
                    <a class="btn-chat" href="https://wa.me/966${ad.whatsapp}" target="_blank" rel="noopener"><svg class="icon"><use href="icons.svg#icon-chat"></use></svg> واتساب</a>
                </div>
            </div>
        </div>
    `;
}

// زر "انضم كمزود" / "انشر إعلانك" بأسفل الرئيسية — بوضع الإعلانات: يوديك لـ"إعلاناتي" مباشرة لو مسجّل دخولك (ماكو تسجيل مزوّد منفصل بعد الآن)، أو لتسجيل الدخول أولاً
function goToProviderSection() {
    if (currentActiveSystem === 'ads') {
        const phone = localStorage.getItem('yashjub_phone');
        window.location.href = phone ? 'provider.html#adsSection' : 'login.html';
    } else {
        window.location.href = 'register-provider.html';
    }
}

// تحميل شهادات العملاء الموافق عليها وعرضها بالصفحة الرئيسية (يختفي القسم كلياً لو ماكو شهادات)
async function loadTestimonials() {
    const section = document.getElementById('testimonialsSection');
    const grid    = document.getElementById('testimonialsGrid');
    if (!section || !grid) return;

    try {
        const res  = await fetch(`${API}/testimonials/approved`);
        const data = await res.json();

        if (!data.success || !data.testimonials.length) {
            section.style.display = 'none';
            return;
        }

        grid.innerHTML = data.testimonials.map(t => {
            let stars = '';
            for (let i = 1; i <= 5; i++) {
                stars += `<svg class="icon" style="opacity:${i <= t.rating ? 1 : 0.25}"><use href="icons.svg#icon-star"></use></svg>`;
            }
            const date = new Date(t.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('ar-SA');

            return `
                <div class="testimonial-card">
                    <div class="testimonial-quote-mark">"</div>
                    <div class="testimonial-stars">${stars}</div>
                    <div class="testimonial-text">${t.comment}</div>
                    <div class="testimonial-name">${t.client_name}</div>
                    <div class="testimonial-meta">${t.service ? t.service + ' • ' : ''}${date}</div>
                </div>
            `;
        }).join('');

        section.style.display = 'block';
    } catch (e) {
        section.style.display = 'none';
    }
}

// تحديث واجهة السايد بار/الجرس لمستخدم مسجّل دخوله (عميل أو مزوّد بوضع الإعلانات) — يُستدعى من checkActiveSystem() بعد تحديد النظام النشط
function applyLoginUI() {
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

        // رابط "إعلاناتي" يظهر لأي مستخدم مسجّل دخوله بوضع الإعلانات فقط (ماكو تسجيل مزوّد منفصل بعد الآن) — بوضع النظام المدفوع ما توصل الدالة هذي أصلاً لمزوّد (يتحوّل لـprovider.html قبلها بـcheckActiveSystem())
        const myAdsLink = document.getElementById('myAdsLink');
        if (myAdsLink) myAdsLink.style.display = (currentActiveSystem === 'ads') ? 'flex' : 'none';

        // إظهار جرس الإشعارات وتحميلها
        const bellWrap = document.getElementById('notifBellWrap');
        if (bellWrap) {
            bellWrap.style.display = 'block';
            loadNotifBell();
            setInterval(loadNotifBell, 60000);
        }
    }
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
        showAppAlert("⚠️ يجب تسجيل الدخول أولاً!", () => window.location.href = 'login.html');
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
checkActiveSystem();
loadTestimonials();
startActiveOrderBar();
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