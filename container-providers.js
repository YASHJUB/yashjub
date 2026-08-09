// كود خطوة اختيار منتج الحاوية

const API = window.location.origin + '/api';

const levelBadges = {
    basic:    { icon: '🥈', label: 'مزود أساسي' },
    verified: { icon: '🥇', label: 'مزود موثق'  },
    business: { icon: '🏆', label: 'شركة'       },
};

const sizeLabels = { small: 'صغيرة (3م)', medium: 'متوسطة (6م)', large: 'كبيرة (12م)' };

let containerLocation = null;

async function loadProducts() {
    const phone = localStorage.getItem('yashjub_phone');
    if (!phone) {
        alert("⚠️ يجب تسجيل الدخول أولاً!");
        window.location.href = 'login.html';
        return;
    }

    const raw = localStorage.getItem('yashjub_container_location');
    if (!raw) {
        window.location.href = 'container-location.html';
        return;
    }

    containerLocation = JSON.parse(raw);
    document.getElementById('locationSummaryText').textContent =
        `📍 ${containerLocation.city} — ${containerLocation.neighborhood}`;

    try {
        const response = await fetch(`${API}/products/available?city=${encodeURIComponent(containerLocation.city)}`);
        const data = await response.json();

        document.getElementById('providersLoading').style.display = 'none';

        if (!data.success || data.products.length === 0) {
            document.getElementById('providersEmpty').style.display = 'block';
            return;
        }

        renderProducts(data.products);

    } catch (error) {
        document.getElementById('providersLoading').style.display = 'none';
        document.getElementById('providersEmpty').style.display = 'block';
    }
}

function renderProducts(products) {
    const container = document.getElementById('providersList');

    container.innerHTML = products.map(p => {
        const badge = levelBadges[p.provider_level] || levelBadges.basic;

        return `
            <div class="provider-select-card">
                <div class="provider-select-top">
                    <div class="provider-select-info">
                        <div class="provider-select-name">${p.name}</div>
                        <div class="provider-select-meta">
                            <span class="provider-select-rating">⭐ ${p.provider_rating}</span>
                            <span class="provider-select-badge">${badge.icon} ${p.provider_name}</span>
                        </div>
                    </div>
                    <button class="btn-small" onclick='selectProduct(${JSON.stringify(p)})'>اختيار ✅</button>
                </div>
                ${p.description ? `<div class="product-item-desc" style="margin-bottom:10px">${p.description}</div>` : ''}
                <div class="provider-select-prices" style="grid-template-columns:1fr 1fr">
                    <div class="provider-price-item">
                        <span class="provider-price-label">الحجم</span>
                        <span class="provider-price-value">${sizeLabels[p.size] || p.size}</span>
                    </div>
                    <div class="provider-price-item">
                        <span class="provider-price-label">السعر</span>
                        <span class="provider-price-value">${p.price} ريال / ${p.min_days} أيام</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function selectProduct(product) {
    localStorage.setItem('yashjub_selected_product', JSON.stringify({
        id:             product.id,
        name:           product.name,
        description:    product.description,
        size:           product.size,
        price:          product.price,
        minDays:        product.min_days,
        providerId:     product.provider_id,
        providerName:   product.provider_name,
        providerRating: product.provider_rating,
    }));

    window.location.href = `order.html?service=${encodeURIComponent('حاوية')}`;
}

loadProducts();
