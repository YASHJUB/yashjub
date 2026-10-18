// كود صفحة إعلانات القسم (منصة غوث معاهدة)

const API = window.location.origin + '/api';

// المزوّد مقفل على لوحة المزود فقط — ما يقدر يدخل صفحات العميل إطلاقاً (تصفح الإعلانات هنا صفحة عميل)
(function checkProviderLock() {
    if (localStorage.getItem('yashjub_type') === 'provider') {
        window.location.href = 'provider.html';
    }
})();

const AD_CATEGORY_ICONS = { 'سطحة': 'tow-truck', 'حاوية': 'box', 'معدات ثقيلة': 'crane' };

const params       = new URLSearchParams(window.location.search);
const currentCategory = params.get('category') || '';

// تحميل عنوان القسم + المدن + أول بحث
function loadAdsPage() {
    const icon = AD_CATEGORY_ICONS[currentCategory] || 'wrench';
    document.getElementById('categoryIconUse').setAttribute('href', `icons.svg#icon-${icon}`);
    document.getElementById('categoryTitle').textContent = currentCategory || 'كل الإعلانات';

    loadCities();
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

// البحث عن الإعلانات حسب الفلاتر الحالية
async function searchAds() {
    const city       = document.getElementById('searchCity').value;
    const district   = document.getElementById('searchDistrict').value.trim();
    const priceFrom  = document.getElementById('searchPriceFrom').value;
    const priceTo    = document.getElementById('searchPriceTo').value;

    const query = new URLSearchParams();
    if (currentCategory) query.set('category', currentCategory);
    if (city)             query.set('city', city);
    if (district)         query.set('district', district);
    if (priceFrom)        query.set('price_from', priceFrom);
    if (priceTo)          query.set('price_to', priceTo);

    try {
        const res  = await fetch(`${API}/ads?${query.toString()}`);
        const data = await res.json();
        if (!data.success) return;

        document.getElementById('categoryCount').textContent = `${data.ads.length} إعلان`;
        renderAdsResults(data.ads);
    } catch (e) {
        renderAdsResults([]);
    }
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

// بطاقة إعلان (نفس المكوّن المستخدم بالصفحة الرئيسية)
function renderAdCard(ad) {
    const icon = AD_CATEGORY_ICONS[ad.category] || 'wrench';
    const desc = ad.description ? (ad.description.length > 80 ? ad.description.slice(0, 80) + '...' : ad.description) : '';

    return `
        <div class="ad-card" onclick="window.location.href='ad-details.html?id=${ad.id}'">
            <div class="ad-card-category"><svg class="icon"><use href="icons.svg#icon-${icon}"></use></svg> ${ad.category} — ${ad.provider_name || 'مزوّد'}</div>
            <div class="ad-card-meta">
                <span><svg class="icon"><use href="icons.svg#icon-star"></use></svg> ${ad.avg_rating || '—'} (${ad.reviews_count || 0} تقييم)</span>
                <span><svg class="icon"><use href="icons.svg#icon-eye"></use></svg> ${ad.views_count} مشاهدة</span>
            </div>
            <div class="ad-card-location"><svg class="icon"><use href="icons.svg#icon-pin"></use></svg> ${ad.city}${ad.district ? ' — ' + ad.district : ''}</div>
            <div class="ad-card-price"><svg class="icon"><use href="icons.svg#icon-cash"></use></svg> من ${ad.price_from} ريال</div>
            <div class="ad-card-divider"></div>
            <div class="ad-card-desc">${desc}</div>
            <div class="ad-card-divider"></div>
            <div class="ad-card-actions" onclick="event.stopPropagation()">
                <a class="btn-call" href="tel:+966${ad.provider_phone}"><svg class="icon"><use href="icons.svg#icon-phone-call"></use></svg> اتصال</a>
                <a class="btn-chat" href="https://wa.me/966${ad.whatsapp}" target="_blank" rel="noopener"><svg class="icon"><use href="icons.svg#icon-chat"></use></svg> واتساب</a>
            </div>
        </div>
    `;
}

// تشغيل عند فتح الصفحة
loadAdsPage();
