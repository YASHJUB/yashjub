// كود صفحة إعلانات القسم (منصة عتاد معاهدة)

const API = window.location.origin + '/api';

// المزوّد مقفل على لوحة المزود فقط بوضع النظام المدفوع — بوضع الإعلانات يتصفح الإعلانات كأي مستخدم
(async function checkProviderLock() {
    if (localStorage.getItem('yashjub_type') !== 'provider') return;

    try {
        const res  = await fetch(`${API}/settings/active-system`);
        const data = await res.json();
        if (data.activeSystem !== 'ads') window.location.href = 'provider.html';
    } catch (e) {
        window.location.href = 'provider.html';
    }
})();

const AD_CATEGORY_ICONS = { 'سطحة': 'tow-truck', 'حاوية': 'box', 'معدات ثقيلة': 'crane' };

const params       = new URLSearchParams(window.location.search);
const currentCategory  = params.get('category') || '';
const currentEquipment = params.get('equipment') || ''; // نوع العدة — قسم "معدات ثقيلة" فقط (راجع "اختر نوع العدة" بالرئيسية)

// تحميل عنوان القسم + المدن + أول بحث
async function loadAdsPage() {
    const icon = AD_CATEGORY_ICONS[currentCategory] || 'wrench';
    document.getElementById('categoryIconUse').setAttribute('href', `icons.svg#icon-${icon}`);
    document.getElementById('categoryTitle').textContent = currentEquipment
        ? `${currentCategory} — ${currentEquipment}`
        : (currentCategory || 'كل الإعلانات');

    loadCities();
    await loadFavoriteIds();
    searchAds();
}

// تحميل المدن المتاحة من لوحة الإدارة (نفس آلية container-location.js)
async function loadCities() {
    const select = document.getElementById('searchCity');
    try {
        const res  = await fetch(`${API}/cities/active`);
        const data = await res.json();

        if (data.success && data.cities.length) {
            select.innerHTML = '<option value="">كل المدن</option>' +
                data.cities.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        }
    } catch (e) {
        // تعذّر التحميل — تبقى "كل المدن" فقط بالقائمة
    }
}

// البحث عن الإعلانات حسب الفلاتر الحالية + كلمة البحث (تُطبَّق محلياً على العنوان/الوصف، السيرفر ما يدعم بحث نصي عام)
async function searchAds() {
    const city       = document.getElementById('searchCity').value;
    const district   = document.getElementById('searchDistrict').value.trim();
    const priceFrom  = document.getElementById('searchPriceFrom').value;
    const priceTo    = document.getElementById('searchPriceTo').value;
    const keyword    = document.getElementById('searchKeyword').value.trim().toLowerCase();

    const query = new URLSearchParams();
    if (currentCategory)  query.set('category', currentCategory);
    if (currentEquipment) query.set('equipment_type', currentEquipment);
    if (city)             query.set('city', city);
    if (district)         query.set('district', district);
    if (priceFrom)        query.set('price_from', priceFrom);
    if (priceTo)          query.set('price_to', priceTo);

    try {
        const res  = await fetch(`${API}/ads?${query.toString()}`);
        const data = await res.json();
        if (!data.success) return;

        let ads = data.ads;
        if (keyword) {
            ads = ads.filter(ad =>
                (ad.title || '').toLowerCase().includes(keyword) ||
                (ad.description || '').toLowerCase().includes(keyword)
            );
        }

        document.getElementById('categoryCount').textContent = `${ads.length} إعلان`;
        renderAdsResults(ads);
    } catch (e) {
        renderAdsResults([]);
    }
}

// فتح/إغلاق بطاقة الفلاتر المنسدلة
function toggleFilterPanel(e) {
    e.stopPropagation();
    document.getElementById('filterPanel').classList.toggle('open');
}

// إغلاق البطاقة عند الضغط خارجها
document.addEventListener('click', (e) => {
    const panel = document.getElementById('filterPanel');
    const btn   = document.getElementById('filterBtn');
    if (panel && panel.classList.contains('open') && !panel.contains(e.target) && !btn.contains(e.target)) {
        panel.classList.remove('open');
    }
});

function applyFilterPanel() {
    document.getElementById('filterPanel').classList.remove('open');
    updateFilterBtnState();
    searchAds();
}

function clearFilterPanel() {
    document.getElementById('searchCity').value       = '';
    document.getElementById('searchDistrict').value   = '';
    document.getElementById('searchPriceFrom').value  = '';
    document.getElementById('searchPriceTo').value    = '';
    document.getElementById('filterPanel').classList.remove('open');
    updateFilterBtnState();
    searchAds();
}

// تحديد شكل زر الفلترة (أصفر + نقطة) حسب وجود فلتر مفعّل
function updateFilterBtnState() {
    const active = document.getElementById('searchCity').value ||
                   document.getElementById('searchDistrict').value.trim() ||
                   document.getElementById('searchPriceFrom').value ||
                   document.getElementById('searchPriceTo').value;
    document.getElementById('filterBtn').classList.toggle('active', !!active);
}

function renderAdsResults(ads) {
    const container = document.getElementById('adsResultsGrid');

    if (!ads.length) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1">
                <div class="empty-icon"><svg class="icon"><use href="icons.svg#icon-inbox-empty"></use></svg></div>
                <div class="empty-title">لا يوجد إعلانات في هذه المنطقة</div>
                <div class="empty-sub">كن أول من ينشر إعلاناً هنا! <svg class="icon"><use href="icons.svg#icon-rocket"></use></svg></div>
            </div>`;
        return;
    }

    container.innerHTML = ads.map(renderAdCard).join('');
}

// بطاقة إعلان (نفس المكوّن المستخدم بالصفحة الرئيسية) — صورة الإعلان الأولى خلفية البطاقة مع تظليل داكن، أو خلفية سوداء لو بدون صور
function renderAdCard(ad) {
    const icon = AD_CATEGORY_ICONS[ad.category] || 'wrench';
    let images = [];
    try { images = JSON.parse(ad.images || '[]'); } catch (e) { images = []; }
    const hasImage = images.length > 0;
    const bgStyle = hasImage ? `background-image:url('${images[0]}')` : '';
    const isFav = favoriteAdIds.has(ad.id);

    return `
        <div class="ad-card ${ad.is_featured ? 'featured' : ''}" style="${bgStyle}" onclick="window.location.href='ad-details.html?id=${ad.id}'">
            ${hasImage ? '<div class="ad-card-overlay"></div>' : ''}
            ${ad.is_featured ? '<div class="ad-card-featured-badge"><svg class="icon"><use href="icons.svg#icon-star"></use></svg> متصدر</div>' : ''}
            <button class="ad-card-fav-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite(${ad.id}, this)">
                <svg class="icon"><use href="icons.svg#icon-heart"></use></svg>
            </button>
            <div class="ad-card-content">
                <div class="ad-card-category"><svg class="icon"><use href="icons.svg#icon-${icon}"></use></svg> ${ad.title}</div>
                <div class="ad-card-provider">${ad.category} — ${ad.provider_name || 'مزوّد'} ${ad.provider_is_verified ? '<span class="verified-badge" title="حساب موثق">✅</span>' : ''}</div>
                <div class="ad-card-meta">
                    <span class="ad-card-rating"><svg class="icon"><use href="icons.svg#icon-star"></use></svg> ${ad.avg_rating || '—'} (${ad.reviews_count || 0} تقييم)</span>
                    <span><svg class="icon"><use href="icons.svg#icon-eye"></use></svg> ${ad.views_count} مشاهدة</span>
                </div>
                <div class="ad-card-location"><svg class="icon"><use href="icons.svg#icon-pin"></use></svg> ${ad.city}${ad.district ? ' — ' + ad.district : ''}</div>
                <div class="ad-card-price"><svg class="icon"><use href="icons.svg#icon-cash"></use></svg> من ${ad.price_from} ريال</div>
            </div>
        </div>
    `;
}

// ══ مفضلة الإعلانات ══

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

async function toggleFavorite(adId, btnEl) {
    const phone = localStorage.getItem('yashjub_phone');
    if (!phone) {
        showAppAlert('⚠️ سجّل دخولك لإضافة المفضلة', () => window.location.href = 'login.html');
        return;
    }

    const wasFav = favoriteAdIds.has(adId);
    btnEl.classList.toggle('active', !wasFav);
    btnEl.classList.remove('pulse');
    void btnEl.offsetWidth;
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
        btnEl.classList.toggle('active', wasFav);
        wasFav ? favoriteAdIds.add(adId) : favoriteAdIds.delete(adId);
    }
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

// تشغيل عند فتح الصفحة
loadAdsPage();
loadTheme();
