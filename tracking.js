// كود تتبع الطلب في غَوْث

const API = window.location.origin + '/api';

let currentOrder        = null;
let chatPollInterval    = null;
let trackingPollInterval = null;
let lastKnownStatus     = null;

// تحميل بيانات الطلب
function loadOrder() {
    const orderData = localStorage.getItem('yashjub_order');

    if (!orderData) {
        window.location.href = 'index.html';
        return;
    }

    const order = JSON.parse(orderData);
    currentOrder = order;

    // تحديث الصفحة ببيانات الطلب
    document.getElementById('trackingIcon').textContent   = order.icon;
    document.getElementById('trackingService').textContent = order.service;
    document.getElementById('orderNumber').textContent    = `#${order.id}`;
    document.getElementById('trackingAddress').textContent = order.address;
    document.getElementById('trackingTime').textContent   = order.time;
    document.getElementById('trackingPrice').textContent  = `${order.price} ريال`;
    document.getElementById('trackingDate').textContent   = order.createdAt;

    // قسم التواصل مع المزود (يظهر فقط لو فيه مزود مرتبط فعلياً بالطلب)
    if (order.providerName) {
        document.getElementById('providerNameText').textContent   = order.providerName;
        document.getElementById('providerRatingText').textContent = order.providerRating;
        document.getElementById('contactProviderSection').style.display = 'block';
        loadChatMessages();
        chatPollInterval = setInterval(loadChatMessages, 10000);
    }

    // خريطة الموقع (تظهر فقط لو الطلب فيه إحداثيات محفوظة)
    if (order.lat && order.lng) {
        document.getElementById('trackingMapSection').style.display = 'block';

        const map = L.map('trackingMap', { zoomControl: true, dragging: true, scrollWheelZoom: false })
            .setView([order.lat, order.lng], 14);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
        }).addTo(map);

        L.marker([order.lat, order.lng]).addTo(map);
    }

    // بدء التتبع الحقيقي (استطلاع حالة الطلب من السيرفر)
    startTrackingPoll();
}

// اتصال مباشر بالمزود
function callProvider() {
    if (!currentOrder || !currentOrder.providerPhone) return;
    window.location.href = `tel:+966${currentOrder.providerPhone}`;
}

// إظهار/إخفاء لوحة الشات
function toggleChat() {
    const panel = document.getElementById('chatPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

// تحميل رسائل الشات من السيرفر
async function loadChatMessages() {
    if (!currentOrder) return;

    try {
        const res  = await fetch(`${API}/chats/${currentOrder.id}`);
        const data = await res.json();
        if (data.success) renderChatMessages(data.messages);
    } catch (e) {}
}

// عرض رسائل الشات (تتمايز حسب المرسل: العميل يمين رمادي، المزوّد يسار أصفر، الإدارة وسط أسود)
function renderChatMessages(messages) {
    const container = document.getElementById('chatMessages');

    if (messages.length === 0) {
        container.innerHTML = '<div class="chat-empty">ابدأ المحادثة مع المزود...</div>';
        return;
    }

    const wasAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 30;

    container.innerHTML = messages.map(m => `
        <div class="chat-bubble sender-${m.sender}">
            <div class="chat-bubble-text">${m.message}</div>
            <div class="chat-bubble-time">${new Date(m.created_at.replace(' ', 'T') + 'Z').toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
    `).join('');

    if (wasAtBottom) container.scrollTop = container.scrollHeight;
}

// إرسال رسالة شات
async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const text  = input.value.trim();

    if (!text || !currentOrder) return;

    input.value = '';

    try {
        await fetch(`${API}/chats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId: currentOrder.id,
                sender: 'client',
                senderPhone: localStorage.getItem('yashjub_phone'),
                message: text,
            }),
        });
        loadChatMessages();
    } catch (e) {}
}

// ══ تتبع حقيقي لحالة الطلب (استطلاع كل 10 ثواني) ══

const STEP_DONE_COUNT = { pending: 1, accepted: 2, arrived: 3, completed: 4 };

const STEP_WAITING_ICONS = {
    2: '<svg class="icon"><use href="icons.svg#icon-hourglass"></use></svg>',
    3: '<svg class="icon"><use href="icons.svg#icon-car"></use></svg>',
    4: '<svg class="icon"><use href="icons.svg#icon-confetti"></use></svg>',
};

function startTrackingPoll() {
    pollOrderStatus();
    trackingPollInterval = setInterval(pollOrderStatus, 10000);
}

async function pollOrderStatus() {
    if (!currentOrder) return;

    try {
        const res  = await fetch(`${API}/orders/${currentOrder.id}`);
        const data = await res.json();
        if (data.success) applyOrderStatus(data.order);
    } catch (e) {}
}

function applyOrderStatus(order) {
    currentOrder.isReviewed = order.is_reviewed;

    // لو صار فيه مزوّد مرتبط بالطلب بعد ما ما كان (المطابقة التلقائية ما زالت قيد الحل)
    if (order.provider_name && document.getElementById('contactProviderSection').style.display === 'none') {
        currentOrder.providerPhone  = order.provider_phone;
        currentOrder.providerRating = order.provider_rating;
        document.getElementById('providerNameText').textContent   = order.provider_name;
        document.getElementById('providerRatingText').textContent = order.provider_rating || '—';
        document.getElementById('contactProviderSection').style.display = 'block';
        loadChatMessages();
        if (!chatPollInterval) chatPollInterval = setInterval(loadChatMessages, 10000);
    }

    updateSteps(order.status);

    if (lastKnownStatus !== null && order.status !== lastKnownStatus) {
        announceStatusChange(order.status);
    }
    lastKnownStatus = order.status;

    if (order.status === 'completed') {
        onOrderCompleted();
    }
}

// تحديث المراحل الأربع حسب الحالة الحقيقية للطلب
function updateSteps(status) {
    const doneCount = STEP_DONE_COUNT[status] || 1;

    for (let i = 1; i <= 4; i++) {
        const step = document.getElementById(`step${i}`);
        step.classList.remove('done', 'active');

        if (i <= doneCount) {
            step.classList.add('done');
            step.querySelector('.step-icon').innerHTML = '<svg class="icon"><use href="icons.svg#icon-check"></use></svg>';
        } else {
            if (i === doneCount + 1) step.classList.add('active');
            step.querySelector('.step-icon').innerHTML = STEP_WAITING_ICONS[i] || '';
        }
    }

    for (let i = 1; i <= 3; i++) {
        document.getElementById(`line${i}`).classList.toggle('done', i <= doneCount);
    }

    document.getElementById('step2Sub').textContent = doneCount >= 2 ? 'تم قبول طلبك من المزود' : 'بانتظار قبول المزود لطلبك';
    document.getElementById('step3Sub').textContent = doneCount >= 3 ? 'وصل المزود لموقعك' : (doneCount >= 2 ? 'المزود بالطريق إليك' : 'بانتظار قبول المزود');
    document.getElementById('step4Sub').textContent = doneCount >= 4 ? 'اكتملت الخدمة بنجاح' : 'بانتظار إنهاء الخدمة';
}

// إشعار داخلي للعميل عند كل تغيّر حقيقي بحالة الطلب
function announceStatusChange(status) {
    const messages = {
        accepted:  '✅ تم قبول طلبك من المزود',
        arrived:   '🚗 المزود وصل لموقعك',
        completed: '🎉 اكتملت خدمتك بنجاح',
    };
    if (messages[status]) alert(messages[status]);
}

// إجراءات اكتمال الطلب
function onOrderCompleted() {
    if (trackingPollInterval) {
        clearInterval(trackingPollInterval);
        trackingPollInterval = null;
    }

    // إغلاق قسم التواصل والشات تلقائياً عند اكتمال الخدمة (المحادثة تبقى محفوظة بالسيرفر للمرجعية)
    document.getElementById('contactProviderSection').style.display = 'none';
    if (chatPollInterval) {
        clearInterval(chatPollInterval);
        chatPollInterval = null;
    }

    document.getElementById('invoiceSection').style.display = 'block';

    if (currentOrder.isReviewed) {
        document.getElementById('ratingSlot').innerHTML = '<div style="text-align:center;font-size:13px;font-weight:700;color:var(--gold)">تم التقييم <svg class="icon"><use href="icons.svg#icon-star"></use></svg></div>';
    }
    document.getElementById('ratingSection').style.display = 'block';
}

// ══ تقييم الخدمة ══

let selectedTrackingRating = 0;

function openTrackingRatingForm() {
    selectedTrackingRating = 0;
    document.getElementById('ratingComment').value = '';
    updateTrackingStarDisplay();
    document.getElementById('ratingFormOverlay').style.display = 'flex';
}

function closeTrackingRatingForm() {
    document.getElementById('ratingFormOverlay').style.display = 'none';
}

function setStarRating(n) {
    selectedTrackingRating = n;
    updateTrackingStarDisplay();
}

function updateTrackingStarDisplay() {
    document.querySelectorAll('#ratingStars .rating-star').forEach(el => {
        const val = parseInt(el.dataset.star, 10);
        el.style.opacity = val <= selectedTrackingRating ? '1' : '0.3';
    });
}

async function submitTrackingRating() {
    const phone   = localStorage.getItem('yashjub_phone');
    const comment = document.getElementById('ratingComment').value.trim();

    if (!selectedTrackingRating) {
        alert('❌ يرجى اختيار عدد النجوم');
        return;
    }
    if (!currentOrder.providerPhone) {
        alert('❌ ما فيه مزوّد مرتبط بهذا الطلب لتقييمه');
        return;
    }

    try {
        const res  = await fetch(`${API}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId: currentOrder.id,
                reviewerPhone: phone,
                reviewerType: 'client',
                reviewedPhone: currentOrder.providerPhone,
                reviewedType: 'provider',
                rating: selectedTrackingRating,
                comment,
            }),
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('ratingSlot').innerHTML = '<div style="text-align:center;font-size:13px;font-weight:700;color:var(--gold)">تم التقييم <svg class="icon"><use href="icons.svg#icon-star"></use></svg></div>';
            closeTrackingRatingForm();
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// الذهاب لصفحة الفاتورة
function goToInvoice() {
    if (currentOrder) window.location.href = `invoice.html?id=${currentOrder.id}`;
}

// تشغيل عند فتح الصفحة
loadOrder();