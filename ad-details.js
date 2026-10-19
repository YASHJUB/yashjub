// كود صفحة تفاصيل الإعلان (منصة غوث معاهدة)

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

const adId = new URLSearchParams(window.location.search).get('id');

let currentAd        = null;
let galleryImages    = [];
let galleryIndex     = 0;
let selectedAdRating = 0;

async function loadAdDetails() {
    if (!adId) {
        showAppAlert('⚠️ إعلان غير موجود', () => window.location.href = 'index.html');
        return;
    }

    try {
        const res  = await fetch(`${API}/ads/${adId}`);
        const data = await res.json();

        if (!data.success) {
            showAppAlert(`❌ ${data.message}`, () => window.location.href = 'index.html');
            return;
        }

        currentAd = data.ad;
        renderAdDetails(currentAd);
        loadAdReviews();
    } catch (e) {
        showAppAlert('❌ خطأ في الاتصال بالسيرفر', () => window.location.href = 'index.html');
    }
}

function renderAdDetails(ad) {
    const icon = AD_CATEGORY_ICONS[ad.category] || 'wrench';
    document.getElementById('adCategoryIcon').setAttribute('href', `icons.svg#icon-${icon}`);
    document.getElementById('adTitle').textContent    = ad.title;
    document.getElementById('adCategory').textContent = ad.category;

    document.getElementById('adProviderName').textContent = ad.provider_name || 'مزوّد';
    document.getElementById('adRating').innerHTML = ad.avg_rating
        ? `<svg class="icon" style="color:#F5C518;width:13px;height:13px"><use href="icons.svg#icon-star"></use></svg> ${ad.avg_rating} (${ad.reviews_count} تقييم)`
        : 'بدون تقييم بعد';
    document.getElementById('adLocation').textContent = ad.city + (ad.district ? ' — ' + ad.district : '');
    document.getElementById('adPrice').textContent     = ad.price_to ? `من ${ad.price_from} إلى ${ad.price_to} ريال` : `من ${ad.price_from} ريال`;
    document.getElementById('adViews').textContent     = `${ad.views_count} مشاهدة`;
    document.getElementById('adDescription').textContent = ad.description || '';

    document.getElementById('adCallBtn').href = `tel:+966${ad.provider_phone}`;
    const whatsappText = encodeURIComponent(`مرحباً، رأيت إعلانك على منصة غَوْث في قسم ${ad.category} وأود الاستفسار`);
    document.getElementById('adWhatsappBtn').href = `https://wa.me/966${ad.whatsapp}?text=${whatsappText}`;

    try {
        galleryImages = JSON.parse(ad.images || '[]');
    } catch (e) {
        galleryImages = [];
    }

    if (galleryImages.length) {
        document.getElementById('adGallery').style.display = 'block';
        galleryIndex = 0;
        renderGalleryImage();
    }
}

function renderGalleryImage() {
    document.getElementById('adGalleryImg').src = galleryImages[galleryIndex];

    const dotsWrap = document.getElementById('adGalleryDots');
    dotsWrap.innerHTML = galleryImages.length > 1
        ? galleryImages.map((_, i) => `<span class="ad-gallery-dot ${i === galleryIndex ? 'active' : ''}" onclick="goToGalleryImage(${i})"></span>`).join('')
        : '';
}

function changeGalleryImage(delta) {
    galleryIndex = (galleryIndex + delta + galleryImages.length) % galleryImages.length;
    renderGalleryImage();
}

function goToGalleryImage(i) {
    galleryIndex = i;
    renderGalleryImage();
}

// ══ التقييمات ══

async function loadAdReviews() {
    try {
        const res  = await fetch(`${API}/ads/${adId}/reviews`);
        const data = await res.json();
        if (!data.success) return;

        const reviews = data.reviews;
        document.getElementById('adReviewsSummary').textContent = reviews.length
            ? `${reviews.length} تقييم على هذا الإعلان`
            : 'لا توجد تقييمات بعد';

        // تحديث متوسط التقييم بأعلى الصفحة من نفس بيانات المراجعات (بدون إعادة طلب الإعلان — تفادياً لزيادة عدد المشاهدات بالغلط)
        const ratingEl = document.getElementById('adRating');
        if (reviews.length) {
            const avg = Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10;
            ratingEl.innerHTML = `<svg class="icon" style="color:#F5C518;width:13px;height:13px"><use href="icons.svg#icon-star"></use></svg> ${avg} (${reviews.length} تقييم)`;
        } else {
            ratingEl.textContent = 'بدون تقييم بعد';
        }

        document.getElementById('adReviewsList').innerHTML = reviews.map(r => `
            <div class="my-review-item">
                <div class="my-review-stars">${Array.from({ length: 5 }, (_, i) =>
                    `<svg class="icon" style="opacity:${i < r.rating ? 1 : 0.25}"><use href="icons.svg#icon-star"></use></svg>`
                ).join('')}</div>
                <div style="font-size:13px;font-weight:700;margin-top:4px">${r.reviewer_name || 'مستخدم'}</div>
                ${r.comment ? `<div class="my-review-comment">${r.comment}</div>` : ''}
                <div class="my-review-date">${new Date(r.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('ar-SA')}</div>
            </div>
        `).join('') || '<p style="font-size:13px;color:#999;text-align:center;padding:16px 0">لا توجد تقييمات بعد — كن أول من يقيّم</p>';
    } catch (e) {}
}

function openAdRatingForm() {
    const phone = localStorage.getItem('yashjub_phone');
    if (!phone) {
        showAppAlert('⚠️ يجب تسجيل الدخول أولاً لإضافة تقييم', () => window.location.href = 'login.html');
        return;
    }

    selectedAdRating = 0;
    document.getElementById('adRatingComment').value = '';
    updateAdStarDisplay();
    document.getElementById('adRatingOverlay').style.display = 'flex';
}

function closeAdRatingForm() {
    document.getElementById('adRatingOverlay').style.display = 'none';
}

function setAdStarRating(n) {
    selectedAdRating = n;
    updateAdStarDisplay();
}

function updateAdStarDisplay() {
    document.querySelectorAll('#adRatingStars .rating-star').forEach(el => {
        const val = parseInt(el.dataset.star, 10);
        el.style.opacity = val <= selectedAdRating ? '1' : '0.3';
    });
}

async function submitAdRating() {
    const phone   = localStorage.getItem('yashjub_phone');
    const name    = localStorage.getItem('yashjub_name');
    const comment = document.getElementById('adRatingComment').value.trim();

    if (!selectedAdRating) {
        alert('❌ يرجى اختيار عدد النجوم');
        return;
    }

    try {
        const res  = await fetch(`${API}/ads/${adId}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reviewerPhone: phone,
                reviewerName: name || null,
                rating: selectedAdRating,
                comment,
            }),
        });
        const data = await res.json();

        if (data.success) {
            closeAdRatingForm();
            showAppAlert('✅ تم إرسال تقييمك، شكراً لك!');
            loadAdReviews();
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// زر "مراسلة" — ينشئ محادثة (أو يرجع الموجودة أصلاً) ويوديك لها بـmessages.html مع رسالة جاهزة بحقل الإرسال
async function startConversation() {
    const phone = localStorage.getItem('yashjub_phone');

    if (!phone) {
        showAppAlert('⚠️ يجب تسجيل الدخول أولاً', () => window.location.href = 'login.html');
        return;
    }

    if (!currentAd) return;

    if (phone === currentAd.provider_phone) {
        alert('❌ لا يمكنك مراسلة نفسك بإعلانك');
        return;
    }

    try {
        const res  = await fetch(`${API}/conversations`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                adId:       currentAd.id,
                user1Phone: phone,
                user2Phone: currentAd.provider_phone,
            }),
        });
        const data = await res.json();

        if (data.success) {
            const draft = `مرحباً، رأيت إعلانك عن ${currentAd.title} في ${currentAd.city} وأود الاستفسار`;
            window.location.href = `messages.html?conversation=${data.conversation.id}&draft=${encodeURIComponent(draft)}`;
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// تشغيل عند فتح الصفحة
loadAdDetails();
