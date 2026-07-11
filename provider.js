// كود لوحة تحكم المزود في يشجب

let countdownInterval;
let seconds = 60;
let todayOrders   = 2;
let todayEarnings = 418;

// تحميل اللوحة
function loadDashboard() {
    document.getElementById('todayOrders').textContent   = todayOrders;
    document.getElementById('todayEarnings').textContent = todayEarnings;

    // بدء العداد التنازلي
    startCountdown();

    // محاكاة طلب وارد
    loadIncomingOrder();
}

// تحميل الطلب الوارد
function loadIncomingOrder() {
    const order = localStorage.getItem('yashjub_order');

    if (order) {
        const data = JSON.parse(order);
        document.getElementById('newOrderService').textContent = `${data.icon} ${data.service}`;
        document.getElementById('newOrderAddress').textContent = data.address;
        const fee   = Math.round(data.price * 0.07);
        const net   = data.price - fee;
        document.getElementById('newOrderPrice').textContent   = `${net} ريال`;
    }
}

// العداد التنازلي
function startCountdown() {
    seconds = 60;
    const bar = document.getElementById('countdownBar');

    countdownInterval = setInterval(() => {
        seconds--;
        const pct = (seconds / 60) * 100;
        bar.style.width = `${pct}%`;
        document.getElementById('countdownText').textContent = `${seconds} ثانية للرد`;

        if (seconds <= 0) {
            clearInterval(countdownInterval);
            rejectOrder();
        }
    }, 1000);
}

// قبول الطلب
function acceptOrder() {
    clearInterval(countdownInterval);
    document.getElementById('newOrderCard').style.display = 'none';

    todayOrders++;
    todayEarnings += 186;

    document.getElementById('todayOrders').textContent   = todayOrders;
    document.getElementById('todayEarnings').textContent = todayEarnings;

    alert('✅ تم قبول الطلب!\nتوجه للموقع المحدد 📍');
    addToHistory('وايت ماء', '🚚', 'الموقع الجديد', 186, 'مكتمل');
}

// رفض الطلب
function rejectOrder() {
    clearInterval(countdownInterval);
    document.getElementById('newOrderCard').style.display = 'none';
    alert('تم رفض الطلب ❌');
}

// إضافة للتاريخ
function addToHistory(service, icon, address, price, status) {
    const list = document.getElementById('historyList');
    const item = document.createElement('div');
    item.className = 'history-item new-item';
    item.innerHTML = `
        <div class="history-icon">${icon}</div>
        <div class="history-info">
            <div class="history-service">${service}</div>
            <div class="history-address">${address}</div>
        </div>
        <div class="history-right">
            <div class="history-price">${price} ريال</div>
            <div class="history-status done">${status}</div>
        </div>
    `;
    list.insertBefore(item, list.firstChild);
}

// تغيير حالة التوفر
function toggleAvailability() {
    const toggle = document.getElementById('availableToggle');
    const label  = document.getElementById('statusLabel');

    if (toggle.checked) {
        label.textContent      = 'متاح';
        label.style.color      = '#10B981';
    } else {
        label.textContent      = 'مشغول';
        label.style.color      = '#EF4444';
        document.getElementById('newOrderCard').style.display = 'none';
        clearInterval(countdownInterval);
    }
}

// تشغيل عند فتح الصفحة
loadDashboard();