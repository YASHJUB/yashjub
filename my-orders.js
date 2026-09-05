// كود صفحة طلباتي

const API = window.location.origin + '/api';

const serviceIcons = {
    'وايت ماء':    'truck',
    'سطحة':        'tow-truck',
    'معدات ثقيلة': 'crane',
    'حاوية':       'box',
    'عمالة':       'worker',
}

const statusLabels = {
    'pending':   { label: 'قيد الانتظار', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)'  },
    'accepted':  { label: 'تم القبول',    color: '#3B82F6', bg: 'rgba(59,130,246,0.1)'  },
    'completed': { label: 'مكتمل',        color: '#10B981', bg: 'rgba(16,185,129,0.1)'  },
    'cancelled': { label: 'ملغي',         color: '#EF4444', bg: 'rgba(239,68,68,0.1)'   },
}

// تحميل الطلبات
async function loadOrders() {
    const phone = localStorage.getItem('yashjub_phone');

    if (!phone) {
        alert('⚠️ يجب تسجيل الدخول أولاً');
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('userPhoneHeader').textContent = `طلبات الرقم: +966${phone}`;

    try {
        const response = await fetch(`${API}/orders/user/${phone}`);
        const data     = await response.json();

        document.getElementById('loadingState').style.display = 'none';

        if (!data.success || data.orders.length === 0) {
            document.getElementById('emptyState').style.display = 'block';
            return;
        }

        document.getElementById('ordersList').style.display = 'block';

        // إحصائيات
        const orders    = data.orders;
        const completed = orders.filter(o => o.status === 'completed').length;
        const spent     = orders.reduce((sum, o) => sum + o.price, 0);

        document.getElementById('totalOrders').textContent    = orders.length;
        document.getElementById('completedOrders').textContent = completed;
        document.getElementById('totalSpent').textContent     = spent.toLocaleString();

        // بناء البطاقات
        const container = document.getElementById('ordersCards');
        container.innerHTML = orders.map(order => {
            const icon   = serviceIcons[order.service] || 'wrench';
            const status = statusLabels[order.status]  || { label: order.status, color: '#888', bg: '#f0f0f0' };
            const date   = new Date(order.created_at).toLocaleDateString('ar-SA');

            return `
                <div class="order-card-item">
                    <div class="order-card-top">
                        <div class="order-card-service">
                            <div class="order-card-icon"><svg class="icon"><use href="icons.svg#icon-${icon}"></use></svg></div>
                            <div>
                                <div class="order-card-name">${order.service}</div>
                                <div class="order-card-date">${date}</div>
                            </div>
                        </div>
                        <span class="order-status-badge"
                            style="color:${status.color}; background:${status.bg}">
                            ${status.label}
                        </span>
                    </div>
                    <div class="order-card-divider"></div>
                    <div class="order-card-details">
                        <div class="order-detail">
                            <span class="order-detail-label"><svg class="icon"><use href="icons.svg#icon-pin"></use></svg> الموقع</span>
                            <span class="order-detail-value">${order.address}</span>
                        </div>
                        <div class="order-detail">
                            <span class="order-detail-label"><svg class="icon"><use href="icons.svg#icon-cash"></use></svg> المبلغ</span>
                            <span class="order-detail-value">${order.price} ريال</span>
                        </div>
                        <div class="order-detail">
                            <span class="order-detail-label"><svg class="icon"><use href="icons.svg#icon-receipt"></use></svg> رقم الطلب</span>
                            <span class="order-detail-value">#${order.id}</span>
                        </div>
                    </div>
                    ${order.status === 'completed' ? `
                    <div id="ratingSlot-${order.id}" style="margin-top:12px">
                        ${order.is_reviewed
                            ? `<div style="text-align:center;font-size:13px;font-weight:700;color:var(--gold)">تم التقييم <svg class="icon"><use href="icons.svg#icon-star"></use></svg></div>`
                            : `<button class="btn-small" style="width:100%" onclick="openRatingForm(${order.id}, '${order.provider_phone || ''}')">
                                <svg class="icon"><use href="icons.svg#icon-star"></use></svg> تقييم الخدمة
                               </button>`}
                    </div>
                    <div id="testimonialSlot-${order.id}" style="margin-top:8px">
                        ${hasSubmittedTestimonial(order.id)
                            ? `<div style="text-align:center;font-size:12px;color:var(--text3)">شكراً! شهادتك قيد المراجعة وستظهر بعد موافقة الإدارة</div>`
                            : `<button class="btn-small" style="width:100%" onclick="openTestimonialForm(${order.id}, '${order.service}')">
                                <svg class="icon"><use href="icons.svg#icon-gem"></use></svg> شارك تجربتك ⭐
                               </button>`}
                    </div>` : ''}
                    ${(order.status === 'completed' || order.status === 'cancelled') ? `
                    <button class="btn-small" style="width:100%;margin-top:12px" onclick="openComplaintForm(${order.id}, '${order.provider_phone || ''}')">
                        <svg class="icon"><use href="icons.svg#icon-siren"></use></svg> تقديم شكوى
                    </button>` : ''}
                </div>
            `;
        }).join('');

    } catch (error) {
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('emptyState').style.display   = 'block';
    }
}

// ══ تقديم شكوى ══

let complaintOrderId       = null;
let complaintReportedPhone = null;

function openComplaintForm(orderId, providerPhone) {
    complaintOrderId       = orderId;
    complaintReportedPhone = providerPhone || null;
    document.getElementById('complaintType').value        = 'تأخر';
    document.getElementById('complaintDescription').value = '';
    document.getElementById('complaintFormOverlay').style.display = 'flex';
}

function closeComplaintForm() {
    document.getElementById('complaintFormOverlay').style.display = 'none';
    complaintOrderId       = null;
    complaintReportedPhone = null;
}

async function submitComplaint() {
    const phone       = localStorage.getItem('yashjub_phone');
    const type        = document.getElementById('complaintType').value;
    const description = document.getElementById('complaintDescription').value.trim();

    if (!description) {
        alert('❌ يرجى كتابة تفاصيل الشكوى');
        return;
    }

    try {
        const res  = await fetch(`${API}/complaints`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId: complaintOrderId,
                reporterPhone: phone,
                reporterType: 'client',
                reportedPhone: complaintReportedPhone,
                reportedType: complaintReportedPhone ? 'provider' : null,
                type, description,
            }),
        });
        const data = await res.json();

        if (data.success) {
            closeComplaintForm();
            alert(`✅ تم إرسال شكواك بنجاح — رقم الشكوى للمتابعة: #${data.complaint.id}`);
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// ══ تقييم الخدمة ══

let ratingOrderId       = null;
let ratingReportedPhone = null;
let selectedRating      = 0;

function openRatingForm(orderId, providerPhone) {
    ratingOrderId       = orderId;
    ratingReportedPhone = providerPhone || null;
    selectedRating       = 0;

    document.getElementById('ratingComment').value = '';
    updateStarDisplay();
    document.getElementById('ratingFormOverlay').style.display = 'flex';
}

function closeRatingForm() {
    document.getElementById('ratingFormOverlay').style.display = 'none';
    ratingOrderId = null;
}

function setStarRating(n) {
    selectedRating = n;
    updateStarDisplay();
}

function updateStarDisplay() {
    document.querySelectorAll('#ratingStars .rating-star').forEach(el => {
        const val = parseInt(el.dataset.star, 10);
        el.style.opacity = val <= selectedRating ? '1' : '0.3';
    });
}

async function submitRating() {
    const phone   = localStorage.getItem('yashjub_phone');
    const comment = document.getElementById('ratingComment').value.trim();

    if (!selectedRating) {
        alert('❌ يرجى اختيار عدد النجوم');
        return;
    }
    if (!ratingReportedPhone) {
        alert('❌ ما فيه مزوّد مرتبط بهذا الطلب لتقييمه');
        return;
    }

    try {
        const res  = await fetch(`${API}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId: ratingOrderId,
                reviewerPhone: phone,
                reviewerType: 'client',
                reviewedPhone: ratingReportedPhone,
                reviewedType: 'provider',
                rating: selectedRating,
                comment,
            }),
        });
        const data = await res.json();

        if (data.success) {
            const slot = document.getElementById(`ratingSlot-${ratingOrderId}`);
            if (slot) {
                slot.innerHTML = '<div style="text-align:center;font-size:13px;font-weight:700;color:var(--gold)">تم التقييم <svg class="icon"><use href="icons.svg#icon-star"></use></svg></div>';
            }
            closeRatingForm();
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// ══ مشاركة تجربة (شهادة عميل) ══
// ماكو ربط بـ order_id بجدول testimonials، فمنع تكرار الإرسال لنفس الطلب يتم محلياً فقط (localStorage) داخل نفس المتصفح

let testimonialOrderId = null;
let testimonialService = null;
let selectedTestimonialRating = 0;

function getSubmittedTestimonialOrders() {
    try {
        return JSON.parse(localStorage.getItem('yashjub_testimonial_orders') || '[]');
    } catch (e) {
        return [];
    }
}

function hasSubmittedTestimonial(orderId) {
    return getSubmittedTestimonialOrders().includes(orderId);
}

function markTestimonialSubmitted(orderId) {
    const list = getSubmittedTestimonialOrders();
    if (!list.includes(orderId)) {
        list.push(orderId);
        localStorage.setItem('yashjub_testimonial_orders', JSON.stringify(list));
    }
}

function openTestimonialForm(orderId, service) {
    testimonialOrderId = orderId;
    testimonialService = service;
    selectedTestimonialRating = 0;

    document.getElementById('testimonialName').value    = localStorage.getItem('yashjub_name') || '';
    document.getElementById('testimonialComment').value = '';
    document.getElementById('testimonialServiceLabel').textContent = `الخدمة: ${service}`;
    updateTestimonialStarDisplay();
    document.getElementById('testimonialFormOverlay').style.display = 'flex';
}

function closeTestimonialForm() {
    document.getElementById('testimonialFormOverlay').style.display = 'none';
    testimonialOrderId = null;
}

function setTestimonialStarRating(n) {
    selectedTestimonialRating = n;
    updateTestimonialStarDisplay();
}

function updateTestimonialStarDisplay() {
    document.querySelectorAll('#testimonialStars .testimonial-star').forEach(el => {
        const val = parseInt(el.dataset.star, 10);
        el.style.opacity = val <= selectedTestimonialRating ? '1' : '0.3';
    });
}

async function submitTestimonial() {
    const phone   = localStorage.getItem('yashjub_phone');
    const name    = document.getElementById('testimonialName').value.trim();
    const comment = document.getElementById('testimonialComment').value.trim();

    if (!name) {
        alert('❌ يرجى كتابة اسمك');
        return;
    }
    if (!selectedTestimonialRating) {
        alert('❌ يرجى اختيار عدد النجوم');
        return;
    }
    if (comment.length < 20) {
        alert('❌ نص الشهادة لازم يكون 20 حرف على الأقل');
        return;
    }

    try {
        const res  = await fetch(`${API}/testimonials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientPhone: phone,
                clientName: name,
                rating: selectedTestimonialRating,
                comment,
                service: testimonialService,
            }),
        });
        const data = await res.json();

        if (data.success) {
            markTestimonialSubmitted(testimonialOrderId);
            const slot = document.getElementById(`testimonialSlot-${testimonialOrderId}`);
            if (slot) {
                slot.innerHTML = '<div style="text-align:center;font-size:12px;color:var(--text3)">شكراً! شهادتك قيد المراجعة وستظهر بعد موافقة الإدارة</div>';
            }
            closeTestimonialForm();
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// تشغيل عند فتح الصفحة
loadOrders();