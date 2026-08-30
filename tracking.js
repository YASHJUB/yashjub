// كود تتبع الطلب في يشجب

const API = window.location.origin + '/api';

let currentOrder      = null;
let chatPollInterval  = null;

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

    // تشغيل محاكاة التتبع
    simulateTracking();
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

// محاكاة مراحل الطلب
function simulateTracking() {

    // بعد 3 ثواني — تم إيجاد مزود
    setTimeout(() => {
        document.getElementById('line2').classList.add('done');
        document.getElementById('step3').classList.add('active');
        document.getElementById('step3').classList.remove('step');
        document.querySelector('#step2 .step-icon').innerHTML = '<svg class="icon"><use href="icons.svg#icon-check"></use></svg>';
    }, 3000);

    // بعد 6 ثواني — المزود في الطريق
    setTimeout(() => {
        document.getElementById('line3').classList.add('done');
        document.getElementById('step4').classList.add('active');
        document.querySelector('#step3 .step-icon').innerHTML = '<svg class="icon"><use href="icons.svg#icon-check"></use></svg>';
    }, 6000);

    // بعد 10 ثواني — تم التوصيل
    setTimeout(() => {
        document.querySelector('#step4 .step-icon').innerHTML = '<svg class="icon"><use href="icons.svg#icon-check"></use></svg>';
        document.querySelector('#step4 .step-sub').innerHTML  = 'اكتملت الخدمة بنجاح <svg class="icon"><use href="icons.svg#icon-confetti"></use></svg>';
        showComplete();
    }, 10000);
}

// إظهار رسالة الاكتمال
function showComplete() {
    setTimeout(() => {
        // إغلاق قسم التواصل والشات تلقائياً عند اكتمال الخدمة (المحادثة تبقى محفوظة بالسيرفر للمرجعية)
        document.getElementById('contactProviderSection').style.display = 'none';
        if (chatPollInterval) {
            clearInterval(chatPollInterval);
            chatPollInterval = null;
        }

        alert('🎉 تم اكتمال الخدمة بنجاح!\nشكراً لاستخدامك يشجب');
        localStorage.removeItem('yashjub_order');
        window.location.href = 'index.html';
    }, 1000);
}

// تشغيل عند فتح الصفحة
loadOrder();