// كود صفحة قائمة المفضلة (منصة غوث معاهدة)

const API = window.location.origin + '/api';

// المزوّد مقفل على لوحة المزود فقط بوضع النظام المدفوع — بوضع الإعلانات يتصفح كأي مستخدم (نفس نمط ads.js)
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

function loadFavoritesPage() {
    const phone = localStorage.getItem('yashjub_phone');

    if (!phone) {
        showAppAlert('⚠️ سجّل دخولك لعرض قائمة المفضلة', () => window.location.href = 'login.html');
        return;
    }

    loadFavorites(phone);
}

async function loadFavorites(phone) {
    try {
        const res  = await fetch(`${API}/favorites/${phone}`);
        const data = await res.json();
        if (data.success) renderFavorites(data.favorites);
    } catch (e) {
        renderFavorites([]);
    }
}

function renderFavorites(favorites) {
    const container = document.getElementById('favoritesGrid');

    if (!favorites.length) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1">
                <div class="empty-icon"><svg class="icon"><use href="icons.svg#icon-heart"></use></svg></div>
                <div class="empty-title">لا يوجد إعلانات في مفضلتك بعد</div>
                <div class="empty-sub">اضغط على ❤️ في أي إعلان لإضافته لمفضلتك</div>
                <button class="btn" style="margin-top:16px" onclick="window.location.href='ads.html'">تصفح الإعلانات ←</button>
            </div>`;
        return;
    }

    container.innerHTML = favorites.map(renderFavoriteCard).join('');
}

// بطاقة إعلان مفضّل — بطاقة عادية (مع زر قلب مملوء دايماً يحذف من المفضلة) لو الإعلان لسه موجود، أو بطاقة رمادية بديلة لو انحذف الإعلان الأصلي
function renderFavoriteCard(fav) {
    if (!fav.ad_exists) {
        return `
            <div class="favorite-missing-card">
                <svg class="icon"><use href="icons.svg#icon-inbox-empty"></use></svg>
                <div class="favorite-missing-text">هذا الإعلان لم يعد متاحاً</div>
                <button class="btn-small btn-delete-product" onclick="removeFavorite(${fav.ad_id})"><svg class="icon"><use href="icons.svg#icon-trash"></use></svg> حذف من المفضلة</button>
            </div>
        `;
    }

    const icon = AD_CATEGORY_ICONS[fav.category] || 'wrench';
    let images = [];
    try { images = JSON.parse(fav.images || '[]'); } catch (e) { images = []; }
    const hasImage = images.length > 0;
    const bgStyle = hasImage ? `background-image:url('${images[0]}')` : '';

    return `
        <div class="ad-card ${fav.is_featured ? 'featured' : ''}" style="${bgStyle}" onclick="window.location.href='ad-details.html?id=${fav.ad_id}'">
            ${hasImage ? '<div class="ad-card-overlay"></div>' : ''}
            ${fav.is_featured ? '<div class="ad-card-featured-badge"><svg class="icon"><use href="icons.svg#icon-star"></use></svg> متصدر</div>' : ''}
            <button class="ad-card-fav-btn active" onclick="event.stopPropagation(); removeFavorite(${fav.ad_id})">
                <svg class="icon"><use href="icons.svg#icon-heart"></use></svg>
            </button>
            <div class="ad-card-content">
                <div class="ad-card-category"><svg class="icon"><use href="icons.svg#icon-${icon}"></use></svg> ${fav.title}</div>
                <div class="ad-card-provider">${fav.category} — ${fav.provider_name || 'مزوّد'}</div>
                <div class="ad-card-meta">
                    <span class="ad-card-rating"><svg class="icon"><use href="icons.svg#icon-star"></use></svg> ${fav.avg_rating || '—'} (${fav.reviews_count || 0} تقييم)</span>
                    <span><svg class="icon"><use href="icons.svg#icon-eye"></use></svg> ${fav.views_count} مشاهدة</span>
                </div>
                <div class="ad-card-location"><svg class="icon"><use href="icons.svg#icon-pin"></use></svg> ${fav.city}${fav.district ? ' — ' + fav.district : ''}</div>
                <div class="ad-card-price"><svg class="icon"><use href="icons.svg#icon-cash"></use></svg> من ${fav.price_from} ريال</div>
                <div class="ad-card-actions" onclick="event.stopPropagation()">
                    <a class="btn-call" href="tel:+966${fav.provider_phone}"><svg class="icon"><use href="icons.svg#icon-phone-call"></use></svg> اتصال</a>
                    <a class="btn-chat" href="https://wa.me/966${fav.whatsapp}" target="_blank" rel="noopener"><svg class="icon"><use href="icons.svg#icon-chat"></use></svg> واتساب</a>
                </div>
            </div>
        </div>
    `;
}

// حذف من المفضلة — كل العناصر بهذي الصفحة مفضّلة أصلاً، فالضغط على القلب أو زر الحذف يحذف مباشرة ويعيد تحميل القائمة
async function removeFavorite(adId) {
    const phone = localStorage.getItem('yashjub_phone');
    if (!phone) return;

    try {
        await fetch(`${API}/favorites/${adId}/${phone}`, { method: 'DELETE' });
    } catch (e) {}

    loadFavorites(phone);
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
loadFavoritesPage();
loadTheme();
