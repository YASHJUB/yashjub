// عتاد - كود التفاعل الكامل (منصة إعلانات — النظام المدفوع أُزيل بالكامل)

const API = window.location.origin + '/api';

// نسختان ثابتتان احتياطيتان (لو تعذّر الاتصال بالسيرفر) — تصيران ديناميكيتين عبر loadAdCategories()، راجع "إعدادات الأقسام" بالتوثيق
let AD_CATEGORIES      = [
    { name: 'سطحة',       icon: 'tow-truck' },
    { name: 'حاوية',      icon: 'box'       },
    { name: 'معدات ثقيلة', icon: 'crane'     },
];
let AD_CATEGORY_ICONS = { 'سطحة': 'tow-truck', 'حاوية': 'box', 'معدات ثقيلة': 'crane' };

// تُحمَّل أول ما تُفتح الصفحة — تستبدل المصفوفة الثابتة أعلاه بقائمة "إعدادات الأقسام" الحقيقية من لوحة الإدارة لو نجح الطلب
async function loadAdCategories() {
    try {
        const res  = await fetch(`${API}/ad-categories/active`);
        const data = await res.json();
        if (data.success && data.categories.length) {
            AD_CATEGORIES = data.categories.map(c => ({ name: c.name, icon: c.icon }));
            AD_CATEGORY_ICONS = {};
            data.categories.forEach(c => { AD_CATEGORY_ICONS[c.name] = c.icon; });
        }
    } catch (e) {
        // تعذّر التحميل — تبقى الأقسام الثلاثة الثابتة كما هي
    }
}

// أنواع العدة بقسم "معدات ثقيلة" — كل نوع يودّي لإعلانات حقيقية من نفس النوع
const AD_EQUIPMENT_TYPES = [
    { name: 'بوكلين',  icon: 'tractor'      },
    { name: 'شيول',    icon: 'construction' },
    { name: 'قلابي',   icon: 'truck'        },
    { name: 'بوبكات',  icon: 'tractor'      },
    { name: 'خرسانة',  icon: 'building'     },
    { name: 'رافعة',   icon: 'crane'        },
];
let adsEquipmentCounts = {};
let adsCategoryCounts  = {};

// تهيئة الصفحة الرئيسية (أقسام الإعلانات + أحدث الإعلانات)
async function initHomepage() {
    applyLoginUI();
    await loadAdCategories();
    await loadFavoriteIds();

    try {
        const res  = await fetch(`${API}/ads`);
        const data = await res.json();
        if (!data.success) return;

        adsCategoryCounts = {};
        data.ads.forEach(ad => { adsCategoryCounts[ad.category] = (adsCategoryCounts[ad.category] || 0) + 1; });
        renderAdCategoryRows(adsCategoryCounts);

        // عدد الإعلانات لكل نوع عدة بقسم "معدات ثقيلة" تحديداً — تُعرض بلوحة "اختر نوع العدة"
        adsEquipmentCounts = {};
        data.ads.filter(ad => ad.category === 'معدات ثقيلة' && ad.equipment_type).forEach(ad => {
            adsEquipmentCounts[ad.equipment_type] = (adsEquipmentCounts[ad.equipment_type] || 0) + 1;
        });

        const latest = [...data.ads].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6);
        if (latest.length) {
            document.getElementById('latestAdsGrid').innerHTML = latest.map(renderAdCard).join('');
            document.getElementById('latestAdsSection').style.display = 'block';
        }
    } catch (e) {}
}

// يُستدعى تلقائياً من i18n.js's applyLanguage() بعد كل تبديل لغة — يعيد رسم النصوص الديناميكية اللي ما تغطّيها [data-i18n] الثابتة
function onLanguageChange() {
    renderAdCategoryRows(adsCategoryCounts);
}

// صفوف أقسام الإعلانات (الصفحة الرئيسية)
function renderAdCategoryRows(counts) {
    const container = document.getElementById('servicesList');
    if (!container) return;

    container.innerHTML = AD_CATEGORIES.map(c => {
        const onclick = c.name === 'معدات ثقيلة'
            ? 'openAdsEquipmentPanel()'
            : `window.location.href='ads.html?category=${encodeURIComponent(c.name)}'`;
        return `
        <div class="service-row" onclick="${onclick}">
            <div class="service-row-right">
                <div class="service-row-icon"><svg class="icon"><use href="icons.svg#icon-${c.icon}"></use></svg></div>
                <div class="service-row-info">
                    <div class="service-row-name">${t(c.name)}</div>
                </div>
            </div>
            <div class="service-row-left">
                <span class="service-row-count">${counts[c.name] || 0} ${t('إعلان')}</span>
                <span class="service-row-arrow">←</span>
            </div>
        </div>
    `;
    }).join('');
}

// لوحة "اختر نوع العدة" — تظهر عند الضغط على قسم "معدات ثقيلة"، كل نوع يودّي لإعلاناته الفعلية
function openAdsEquipmentPanel() {
    const panel = document.getElementById('adsEquipmentPanel');
    const grid  = document.getElementById('adsEquipmentGrid');
    const isOpen = panel.style.display === 'block';

    if (isOpen) {
        panel.style.display = 'none';
        return;
    }

    grid.innerHTML = AD_EQUIPMENT_TYPES.map(e => `
        <div class="heavy-item" onclick="window.location.href='ads.html?category=${encodeURIComponent('معدات ثقيلة')}&equipment=${encodeURIComponent(e.name)}'">
            <div class="heavy-icon"><svg class="icon"><use href="icons.svg#icon-${e.icon}"></use></svg></div>
            <div class="heavy-name">${t(e.name)}</div>
            <div class="heavy-badge heavy-badge-count">${adsEquipmentCounts[e.name] || 0} ${t('إعلان')}</div>
        </div>
    `).join('');

    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// بطاقة إعلان مشتركة (تُستخدم بالرئيسية وبصفحة ads.html) — صورة الإعلان الأولى خلفية البطاقة مع تظليل داكن، أو خلفية سوداء لو بدون صور
function renderAdCard(ad) {
    const icon = AD_CATEGORY_ICONS[ad.category] || 'wrench';
    let images = [];
    try { images = JSON.parse(ad.images || '[]'); } catch (e) { images = []; }
    const hasImage = images.length > 0;
    const bgStyle = hasImage ? `background-image:url('${images[0]}')` : '';
    const isFav = favoriteAdIds.has(ad.id);

    const isSale = ad.ad_type === 'sale';

    return `
        <div class="ad-card ${ad.is_featured ? 'featured' : ''}" style="${bgStyle}" onclick="window.location.href='ad-details.html?id=${ad.id}'">
            ${hasImage ? '<div class="ad-card-overlay"></div>' : ''}
            <div class="ad-card-type-badge ${isSale ? 'sale' : 'service'}">${isSale ? 'بيع' : 'خدمة'}</div>
            ${ad.is_featured ? '<div class="ad-card-featured-badge"><svg class="icon"><use href="icons.svg#icon-star"></use></svg> متصدر</div>' : ''}
            <button class="ad-card-fav-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite(${ad.id}, this)">
                <svg class="icon"><use href="icons.svg#icon-heart"></use></svg>
            </button>
            <div class="ad-card-content">
                <div class="ad-card-category"><svg class="icon"><use href="icons.svg#icon-${icon}"></use></svg> ${ad.title}</div>
                <div class="ad-card-provider">${ad.category}${ad.provider_name ? ' — ' + ad.provider_name : ''}</div>
                <div class="ad-card-meta">
                    <span class="ad-card-rating"><svg class="icon"><use href="icons.svg#icon-star"></use></svg> ${ad.avg_rating || '—'} (${ad.reviews_count || 0} تقييم)</span>
                    <span><svg class="icon"><use href="icons.svg#icon-eye"></use></svg> ${ad.views_count} مشاهدة</span>
                </div>
                <div class="ad-card-location"><svg class="icon"><use href="icons.svg#icon-pin"></use></svg> ${ad.city}${ad.district ? ' — ' + ad.district : ''}</div>
                <div class="ad-card-price"><svg class="icon"><use href="icons.svg#icon-cash"></use></svg> ${isSale ? `${ad.price_from} ريال` : `من ${ad.price_from} ريال`}</div>
            </div>
        </div>
    `;
}

// ══ مفضلة الإعلانات (مشتركة — تُحمَّل مرة وحدة قبل رسم أي بطاقات إعلان) ══

let favoriteAdIds = new Set();

async function loadFavoriteIds() {
    const phone = localStorage.getItem('yashjub_phone');
    if (!phone) return;

    try {
        const res  = await fetch(`${API}/favorites/${phone}`);
        const data = await res.json();
        if (data.success) favoriteAdIds = new Set(data.favorites.filter(f => f.ad_exists).map(f => f.ad_id));
    } catch (e) {}
}

// إضافة/حذف إعلان من المفضلة — تحديث فوري بالواجهة (بدون إعادة تحميل الصفحة) ثم مزامنة مع السيرفر بالخلفية
async function toggleFavorite(adId, btnEl) {
    const phone = localStorage.getItem('yashjub_phone');
    if (!phone) {
        showAppAlert('⚠️ سجّل دخولك لإضافة المفضلة', () => window.location.href = 'login.html');
        return;
    }

    const wasFav = favoriteAdIds.has(adId);
    btnEl.classList.toggle('active', !wasFav);
    btnEl.classList.remove('pulse');
    void btnEl.offsetWidth; // إعادة تشغيل الـ animation لو ضُغط أكثر من مرة بسرعة
    btnEl.classList.add('pulse');
    wasFav ? favoriteAdIds.delete(adId) : favoriteAdIds.add(adId);

    try {
        if (wasFav) {
            await fetch(`${API}/favorites/${adId}/${phone}`, { method: 'DELETE' });
        } else {
            await fetch(`${API}/favorites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, adId }),
            });
        }
    } catch (e) {
        // فشل الاتصال — رجوع للحالة الأصلية
        btnEl.classList.toggle('active', wasFav);
        wasFav ? favoriteAdIds.add(adId) : favoriteAdIds.delete(adId);
    }
}

// زر "انشر إعلانك الآن" بأسفل الرئيسية — يوديك لـ"إعلاناتي" مباشرة لو مسجّل دخولك، أو لتسجيل الدخول أولاً
function goToProviderSection() {
    const phone = localStorage.getItem('yashjub_phone');
    window.location.href = phone ? 'provider.html#adsSection' : 'login.html';
}

// تحديث واجهة السايد بار/الجرس لمستخدم مسجّل دخوله
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
        document.getElementById('sidebarUserName') && (document.getElementById('sidebarUserName').textContent = savedName || (type === 'provider' ? 'معلن' : 'عميل'));
        document.getElementById('sidebarLoginBtn').style.display  = 'none';
        document.getElementById('sidebarLogoutBtn').style.display = 'block';
        renderSidebarAvatar();

        // إظهار جرس الإشعارات وتحميلها
        const bellWrap = document.getElementById('notifBellWrap');
        if (bellWrap) {
            bellWrap.style.display = 'block';
            loadNotifBell();
            setInterval(loadNotifBell, 60000);
        }

        loadMessagesBadge();
        setInterval(loadMessagesBadge, 30000);
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

// الصورة الشخصية (أفاتار) بالسايد بار — موحّدة للعميل والمزوّد، مكرَّرة بكل صفحة فيها سايد بار (راجع "الصورة الشخصية" بـprofile.js)
function renderSidebarAvatar() {
    const avatarPath = localStorage.getItem('yashjub_avatar');
    const el = document.getElementById('sidebarUserIcon');
    if (el && avatarPath) el.innerHTML = `<img src="${avatarPath}" class="avatar-img" alt="">`;
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
    localStorage.removeItem('yashjub_avatar');
    localStorage.removeItem('yashjub_username');
    location.reload();
}

// تشغيل التحقق عند فتح الصفحة
initHomepage();

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
