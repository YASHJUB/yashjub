// كود تتبع الطلب في غَوْث

const API = window.location.origin + '/api';

let currentOrder        = null;
let chatPollInterval    = null;
let trackingPollInterval = null;
let lastKnownStatus     = null;

let trackingMap        = null;
let customerMapMarker  = null;
let providerMapMarker  = null;
let providerRouteLine  = null;

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

        trackingMap = L.map('trackingMap', { zoomControl: true, dragging: true, scrollWheelZoom: false })
            .setView([order.lat, order.lng], 14);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
        }).addTo(trackingMap);

        customerMapMarker = L.marker([order.lat, order.lng], { icon: customerPinIcon() }).addTo(trackingMap);
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

    if (order.status === 'accepted' || order.status === 'arrived') {
        updateProviderTracking(order);
    } else {
        clearProviderTracking();
    }

    if (order.status === 'completed') {
        onOrderCompleted();
    }
}

// ══ تتبع المزوّد على الخريطة (محاكاة حركة حقيقية عبر API) ══

function customerPinIcon() {
    return L.divIcon({
        className: '',
        html: '<div class="map-pin map-pin-customer"><svg class="icon"><use href="icons.svg#icon-pin"></use></svg></div>',
        iconSize: [34, 34],
        iconAnchor: [17, 34],
    });
}

function providerPinIcon() {
    return L.divIcon({
        className: '',
        html: '<div class="map-pin map-pin-provider"><svg class="icon"><use href="icons.svg#icon-car"></use></svg></div>',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
    });
}

// نقطة تبعد عن (lat,lng) بمسافة distanceKm وزاوية bearingDeg
function offsetLatLng(lat, lng, distanceKm, bearingDeg) {
    const R = 6371;
    const bearing = bearingDeg * Math.PI / 180;
    const lat1 = lat * Math.PI / 180;
    const lng1 = lng * Math.PI / 180;

    const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(distanceKm / R) +
        Math.cos(lat1) * Math.sin(distanceKm / R) * Math.cos(bearing)
    );
    const lng2 = lng1 + Math.atan2(
        Math.sin(bearing) * Math.sin(distanceKm / R) * Math.cos(lat1),
        Math.cos(distanceKm / R) - Math.sin(lat1) * Math.sin(lat2)
    );

    return { lat: lat2 * 180 / Math.PI, lng: lng2 * 180 / Math.PI };
}

function moveTowards(from, to, fraction) {
    return {
        lat: from.lat + (to.lat - from.lat) * fraction,
        lng: from.lng + (to.lng - from.lng) * fraction,
    };
}

function haversineKm(a, b) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2 +
        Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

async function saveProviderLocation(orderId, lat, lng) {
    try {
        await fetch(`${API}/orders/${orderId}/location`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lng }),
        });
    } catch (e) {}
}

async function updateProviderTracking(order) {
    if (!trackingMap || !order.lat || !order.lng) return;

    const customerPos = { lat: order.lat, lng: order.lng };

    // وصل المزود فعلياً — نثبّت موقعه بالضبط على موقع العميل
    if (order.status === 'arrived') {
        await saveProviderLocation(order.id, customerPos.lat, customerPos.lng);
        renderProviderOnMap(customerPos, customerPos, 0);
        return;
    }

    // status === 'accepted' — نحرّك المزود تدريجياً نحو العميل
    let current = (order.provider_lat != null && order.provider_lng != null)
        ? { lat: order.provider_lat, lng: order.provider_lng }
        : null;

    if (!current) {
        // أول مرة بعد القبول — نقطة بداية عشوائية على بعد 2-3 كم
        const bearing  = Math.random() * 360;
        const distance = 2 + Math.random();
        current = offsetLatLng(customerPos.lat, customerPos.lng, distance, bearing);
    } else {
        // نقرّب المزود 15% من المسافة المتبقية بكل مرة
        current = moveTowards(current, customerPos, 0.15);
    }

    await saveProviderLocation(order.id, current.lat, current.lng);
    const distanceKm = haversineKm(current, customerPos);
    renderProviderOnMap(current, customerPos, distanceKm);
}

function renderProviderOnMap(providerPos, customerPos, distanceKm) {
    if (!trackingMap) return;

    const etaMinutes = Math.max(1, Math.round(distanceKm * 2));
    const tooltipText = distanceKm < 0.05
        ? 'المزود وصل لموقعك'
        : `المزود على بعد ${etaMinutes} دقيقة (${distanceKm.toFixed(1)} كم)`;

    if (!providerMapMarker) {
        providerMapMarker = L.marker([providerPos.lat, providerPos.lng], { icon: providerPinIcon() })
            .addTo(trackingMap)
            .bindTooltip(tooltipText, { permanent: true, direction: 'top', offset: [0, -12], className: 'map-distance-tooltip' });
    } else {
        providerMapMarker.setLatLng([providerPos.lat, providerPos.lng]);
        providerMapMarker.setTooltipContent(tooltipText);
    }

    const linePoints = [[providerPos.lat, providerPos.lng], [customerPos.lat, customerPos.lng]];
    if (!providerRouteLine) {
        providerRouteLine = L.polyline(linePoints, { color: '#F5C518', weight: 3, dashArray: '8,6' }).addTo(trackingMap);
    } else {
        providerRouteLine.setLatLngs(linePoints);
    }

    trackingMap.fitBounds(providerRouteLine.getBounds(), { padding: [50, 50], maxZoom: 15 });
}

function clearProviderTracking() {
    if (providerMapMarker) {
        trackingMap && trackingMap.removeLayer(providerMapMarker);
        providerMapMarker = null;
    }
    if (providerRouteLine) {
        trackingMap && trackingMap.removeLayer(providerRouteLine);
        providerRouteLine = null;
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

    clearProviderTracking();

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