// كود صفحة تفاصيل الإعلان (منصة عتاد معاهدة)

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
        checkAdFavorited();
        loadComments();
        loadRelatedAds();
    } catch (e) {
        showAppAlert('❌ خطأ في الاتصال بالسيرفر', () => window.location.href = 'index.html');
    }
}

// ══ إعلانات ذات صلة (نفس القسم، ماعدا الإعلان الحالي) ══

async function loadRelatedAds() {
    try {
        const res  = await fetch(`${API}/ads?category=${encodeURIComponent(currentAd.category)}&limit=9&exclude=${adId}`);
        const data = await res.json();
        if (data.success) renderRelatedAds(data.ads);
    } catch (e) {}
}

function renderRelatedAds(ads) {
    const grid = document.getElementById('relatedAdsGrid');

    let html = ads.map(ad => {
        const icon = AD_CATEGORY_ICONS[ad.category] || 'wrench';
        let images = [];
        try { images = JSON.parse(ad.images || '[]'); } catch (e) { images = []; }
        const hasImage = images.length > 0;
        const bgStyle  = hasImage ? `background-image:url('${images[0]}')` : '';

        return `
            <div class="related-ad-item" style="${bgStyle}" onclick="window.location.href='ad-details.html?id=${ad.id}'">
                ${!hasImage ? `<svg class="icon"><use href="icons.svg#icon-${icon}"></use></svg>` : ''}
            </div>
        `;
    }).join('');

    for (let i = ads.length; i < 9; i++) {
        html += '<div class="related-ad-placeholder"></div>';
    }

    grid.innerHTML = html;
}

// ══ تعليقات الإعلان ══

async function loadComments() {
    const myPhone = localStorage.getItem('yashjub_phone');

    const formWrap    = document.getElementById('commentFormWrap');
    const loginPrompt = document.getElementById('commentLoginPrompt');
    if (myPhone) {
        formWrap.style.display    = 'block';
        loginPrompt.style.display = 'none';
    } else {
        formWrap.style.display    = 'none';
        loginPrompt.style.display = 'block';
    }

    try {
        const res  = await fetch(`${API}/comments/${adId}`);
        const data = await res.json();
        if (data.success) renderComments(data.comments);
    } catch (e) {}
}

function renderComments(comments) {
    document.getElementById('commentsCountLabel').textContent = `(${comments.length})`;

    const list = document.getElementById('commentsList');
    if (!comments.length) {
        list.innerHTML = `<p class="services-subtitle" style="text-align:center">كن أول من يعلّق على هذا الإعلان!</p>`;
        return;
    }

    const myPhone = localStorage.getItem('yashjub_phone');
    const isAdOwner = currentAd && myPhone && myPhone === currentAd.provider_phone;

    list.innerHTML = comments.map(c => {
        const canDelete = myPhone && (myPhone === c.commenter_phone || isAdOwner);
        return `
            <div class="comment-item">
                <div class="comment-avatar"><svg class="icon"><use href="icons.svg#icon-user"></use></svg></div>
                <div class="comment-body">
                    <div class="comment-header">
                        <span class="comment-name">${c.commenter_name || 'مستخدم'}</span>
                        ${c.commenter_is_verified ? '<span class="verified-badge" title="حساب موثق">✅</span>' : ''}
                        ${c.commenter_username ? `<span class="username-inline">@${c.commenter_username}</span>` : ''}
                        <span class="comment-time">${timeAgo(c.created_at)}</span>
                    </div>
                    <div class="comment-text">${c.comment}</div>
                </div>
                ${canDelete ? `<button class="comment-delete-btn" onclick="deleteComment(${c.id})"><svg class="icon"><use href="icons.svg#icon-trash"></use></svg></button>` : ''}
            </div>
        `;
    }).join('');
}

async function submitComment() {
    const phone = localStorage.getItem('yashjub_phone');
    if (!phone) {
        showAppAlert('⚠️ سجّل دخولك للتعليق', () => window.location.href = 'login.html');
        return;
    }

    const input = document.getElementById('commentInput');
    const text  = input.value.trim();
    if (!text) return;

    const name = localStorage.getItem('yashjub_name') || 'مستخدم';

    try {
        const res  = await fetch(`${API}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adId, commenterPhone: phone, commenterName: name, comment: text }),
        });
        const data = await res.json();

        if (!data.success) {
            showAppAlert(`❌ ${data.message}`);
            return;
        }

        input.value = '';
        loadComments();
    } catch (e) {
        showAppAlert('❌ تعذّر إرسال التعليق');
    }
}

async function deleteComment(commentId) {
    try {
        await fetch(`${API}/comments/${commentId}`, { method: 'DELETE' });
    } catch (e) {}
    loadComments();
}

// وقت نسبي بسيط ("منذ X دقيقة/ساعة/يوم") — التواريخ مخزّنة UTC بدون منطقة زمنية بقاعدة البيانات
function timeAgo(dateStr) {
    const then    = new Date(dateStr.replace(' ', 'T') + 'Z').getTime();
    const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));

    if (minutes < 1)  return 'الآن';
    if (minutes < 60) return `منذ ${minutes} دقيقة`;

    const hours = Math.round(minutes / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;

    const days = Math.round(hours / 24);
    return `منذ ${days} يوم`;
}

// ══ مفضلة الإعلانات ══

async function checkAdFavorited() {
    const phone = localStorage.getItem('yashjub_phone');
    if (!phone) return;

    try {
        const res  = await fetch(`${API}/favorites/check/${adId}/${phone}`);
        const data = await res.json();
        if (data.success) document.getElementById('adFavBtn').classList.toggle('active', data.isFavorited);
    } catch (e) {}
}

async function toggleAdFavorite() {
    const phone = localStorage.getItem('yashjub_phone');
    if (!phone) {
        showAppAlert('⚠️ سجّل دخولك لإضافة المفضلة', () => window.location.href = 'login.html');
        return;
    }

    const btn    = document.getElementById('adFavBtn');
    const wasFav = btn.classList.contains('active');

    btn.classList.toggle('active', !wasFav);
    btn.classList.remove('pulse');
    void btn.offsetWidth;
    btn.classList.add('pulse');

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
        btn.classList.toggle('active', wasFav);
    }
}

function renderAdDetails(ad) {
    const icon = AD_CATEGORY_ICONS[ad.category] || 'wrench';
    document.getElementById('adCategoryIcon').setAttribute('href', `icons.svg#icon-${icon}`);
    document.getElementById('adTitle').textContent    = ad.title;
    document.getElementById('adCategory').textContent = ad.category;
    document.getElementById('adFeaturedBadge').style.display = ad.is_featured ? 'inline-flex' : 'none';

    document.getElementById('adProviderName').innerHTML = (ad.provider_name || 'مزوّد') +
        (ad.provider_username ? ` <span class="username-inline">@${ad.provider_username}</span>` : '') +
        (ad.provider_is_verified
            ? ' <span class="verified-badge" title="حساب موثق">✅ موثق</span>'
            : '');
    document.getElementById('adRating').innerHTML = ad.avg_rating
        ? `<svg class="icon" style="color:#F5C518;width:13px;height:13px"><use href="icons.svg#icon-star"></use></svg> ${ad.avg_rating} (${ad.reviews_count} تقييم)`
        : 'بدون تقييم بعد';
    document.getElementById('adLocation').textContent = ad.city + (ad.district ? ' — ' + ad.district : '');
    document.getElementById('adPrice').textContent     = ad.price_to ? `من ${ad.price_from} إلى ${ad.price_to} ريال` : `من ${ad.price_from} ريال`;
    document.getElementById('adViews').textContent     = `${ad.views_count} مشاهدة`;
    document.getElementById('adDescription').textContent = ad.description || '';

    document.getElementById('adCallBtn').href = `tel:+966${ad.provider_phone}`;

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

    if (lightboxOpen) {
        document.getElementById('lightboxImg').src = galleryImages[galleryIndex];
        document.getElementById('lightboxDots').innerHTML = galleryImages.length > 1
            ? galleryImages.map((_, i) => `<span class="ad-gallery-dot ${i === galleryIndex ? 'active' : ''}" onclick="event.stopPropagation(); goToGalleryImage(${i})"></span>`).join('')
            : '';
    }
}

function changeGalleryImage(delta) {
    galleryIndex = (galleryIndex + delta + galleryImages.length) % galleryImages.length;
    renderGalleryImage();
}

function goToGalleryImage(i) {
    galleryIndex = i;
    renderGalleryImage();
}

// ══ عارض الصور بملء الشاشة (لايتبوكس) ══

let lightboxOpen = false;

function openLightbox() {
    if (!galleryImages.length) return;
    lightboxOpen = true;
    document.getElementById('lightboxOverlay').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    renderGalleryImage();
}

function closeLightbox() {
    lightboxOpen = false;
    document.getElementById('lightboxOverlay').style.display = 'none';
    document.body.style.overflow = '';
}

function closeLightboxOnBackdrop(event) {
    if (event.target.id === 'lightboxOverlay') closeLightbox();
}

document.addEventListener('keydown', (e) => {
    if (!lightboxOpen) return;
    if (e.key === 'Escape')    closeLightbox();
    if (e.key === 'ArrowLeft')  changeGalleryImage(1);
    if (e.key === 'ArrowRight') changeGalleryImage(-1);
});

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
                <div style="font-size:13px;font-weight:700;margin-top:4px">${r.reviewer_name || 'مستخدم'} ${r.reviewer_username ? `<span class="username-inline">@${r.reviewer_username}</span>` : ''}</div>
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

// نافذة الإبلاغ عن الإعلان — ترسل شكوى عادية (reportedType:'provider') بـad_id مرتبط، تظهر تلقائياً بفلتر "📢 إعلانات" بلوحة الإدارة
function openReportAdForm() {
    const phone = localStorage.getItem('yashjub_phone');
    if (!phone) {
        showAppAlert('⚠️ يجب تسجيل الدخول أولاً للإبلاغ عن إعلان', () => window.location.href = 'login.html');
        return;
    }
    if (!currentAd) return;

    document.getElementById('reportAdDesc').value = '';
    document.getElementById('reportAdType').value = 'محتوى مخالف';
    document.getElementById('reportAdOverlay').style.display = 'flex';
}

function closeReportAdForm() {
    document.getElementById('reportAdOverlay').style.display = 'none';
}

async function submitAdReport() {
    const phone = localStorage.getItem('yashjub_phone');
    const type  = document.getElementById('reportAdType').value;
    const desc  = document.getElementById('reportAdDesc').value.trim();

    try {
        const res  = await fetch(`${API}/complaints`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adId,
                reporterPhone: phone,
                reporterType: 'client',
                reportedPhone: currentAd.provider_phone,
                reportedType: 'provider',
                type,
                description: desc,
            }),
        });
        const data = await res.json();

        if (data.success) {
            closeReportAdForm();
            showAppAlert('🚨 تم إرسال بلاغك — شكراً لمساعدتك بالحفاظ على جودة المنصة');
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
loadAdDetails();
loadTheme();
