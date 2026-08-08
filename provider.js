// كود لوحة المزود

const API = window.location.origin + '/api';

let countdownInterval;
let countdownSeconds = 60;
let allOrders = [];

// تحميل الصفحة
function loadProvider() {
    const phone = localStorage.getItem('yashjub_phone');
    const type  = localStorage.getItem('yashjub_type');

    if (!phone || type !== 'provider') {
        alert('⚠️ هذه الصفحة للمزودين فقط');
        window.location.href = 'login.html';
        return;
    }

    // تحديث البيانات
    document.getElementById('providerName').textContent        = 'مزود خدمة';
    document.getElementById('providerPhone').textContent       = `+966${phone}`;
    document.getElementById('providerNameSidebar').textContent = 'مزود خدمة';
    document.getElementById('providerPhoneSidebar').textContent = `+966${phone}`;

    // تحميل الطلبات
    loadOrders(phone);

    // محاكاة طلب وارد
    simulateIncomingOrder();
}

// تحميل الطلبات
async function loadOrders(phone) {
    try {
        const res  = await fetch(`${API}/orders/user/${phone}`);
        const data = await res.json();

        if (data.success) {
            allOrders = data.orders;
            renderOrders(allOrders);
            updateStats(allOrders);
            updateWallet(allOrders);
        }
    } catch(e) {
        console.log('خطأ في تحميل الطلبات');
    }
}

// تحديث الإحصائيات
function updateStats(orders) {
    const today     = new Date().toLocaleDateString('ar-SA');
    const todayOrders = orders.filter(o => {
        const orderDate = new Date(o.created_at).toLocaleDateString('ar-SA');
        return orderDate === today;
    });

    const weekRevenue = orders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.price - o.commission), 0);

    document.getElementById('statToday').textContent = todayOrders.length;
    document.getElementById('statWeek').textContent  = weekRevenue.toLocaleString();
    document.getElementById('ordersCount').textContent = `${orders.length} طلب`;
}

// تحديث المحفظة
function updateWallet(orders) {
    const completed = orders.filter(o => o.status === 'completed');
    const pending   = orders.filter(o => o.status === 'pending');

    const totalEarned   = completed.reduce((sum, o) => sum + (o.price - o.commission), 0);
    const pendingAmount = pending.reduce((sum, o) => sum + o.price, 0);

    document.getElementById('walletBalance').textContent  = `${totalEarned.toLocaleString()} ريال`;
    document.getElementById('walletTotal').textContent    = totalEarned.toLocaleString();
    document.getElementById('walletPending').textContent  = pendingAmount.toLocaleString();
    document.getElementById('walletWithdrawn').textContent = '0';
}

// عرض الطلبات
function renderOrders(orders) {
    const container = document.getElementById('providerOrdersList');

    if (orders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <div class="empty-title">لا يوجد طلبات</div>
                <div class="empty-sub">ابدأ باستقبال الطلبات الآن!</div>
            </div>`;
        return;
    }

    const statusLabels = {
        pending:   { label: 'انتظار',  color: '#F59E0B', bg: 'rgba(245,158,11,0.1)'  },
        accepted:  { label: 'مقبول',   color: '#3B82F6', bg: 'rgba(59,130,246,0.1)'  },
        completed: { label: 'مكتمل',   color: '#10B981', bg: 'rgba(16,185,129,0.1)'  },
        cancelled: { label: 'ملغي',    color: '#EF4444', bg: 'rgba(239,68,68,0.1)'   },
    };

    const serviceIcons = {
        'وايت ماء': '🚚', 'سطحة': '🚛', 'حاوية': '📦', 'معدات ثقيلة': '🏗️'
    };

    container.innerHTML = orders.map(o => {
        const status = statusLabels[o.status] || { label: o.status, color: '#888', bg: '#f0f0f0' };
        const icon   = serviceIcons[o.service] || '🔧';
        const date   = new Date(o.created_at).toLocaleDateString('ar-SA');
        const net    = o.price - o.commission;

        return `
            <div class="provider-order-item">
                <div class="provider-order-top">
                    <div class="provider-order-service">
                        <div class="provider-order-icon">${icon}</div>
                        <div>
                            <div class="provider-order-name">${o.service}</div>
                            <div class="provider-order-date">${date}</div>
                        </div>
                    </div>
                    <span class="provider-order-status"
                        style="color:${status.color};background:${status.bg}">
                        ${status.label}
                    </span>
                </div>
                <div class="provider-order-divider"></div>
                <div class="provider-order-details">
                    <div class="provider-order-detail">
                        <span>📍 ${o.address.substring(0, 30)}${o.address.length > 30 ? '...' : ''}</span>
                    </div>
                    <div class="provider-order-detail">
                        <span>💰 صافي الأرباح: <strong>${net} ريال</strong></span>
                    </div>
                </div>
                ${o.status === 'accepted' ? `
                <button class="btn-complete-order" onclick="completeOrder(${o.id})">
                    ✅ تأكيد الاكتمال
                </button>` : ''}
            </div>
        `;
    }).join('');
}

// فلتر الطلبات
function filterOrders(status, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (status === 'all') {
        renderOrders(allOrders);
    } else {
        renderOrders(allOrders.filter(o => o.status === status));
    }
}

// محاكاة طلب وارد
function simulateIncomingOrder() {
    const phone = localStorage.getItem('yashjub_phone');

    // شوف إذا في طلب في localStorage
    const savedOrder = localStorage.getItem('yashjub_order');
    if (savedOrder) {
        const order = JSON.parse(savedOrder);
        document.getElementById('newOrderService').textContent = `${order.icon} ${order.service}`;
        document.getElementById('newOrderAddress').textContent = order.address;
        document.getElementById('newOrderAmount').textContent  = `${Math.round(order.price * 0.95)} ريال`;
        document.getElementById('newOrderClient').textContent  = `+966${phone}`;
        document.getElementById('newOrderSection').style.display = 'block';
        startCountdown();
    } else {
        document.getElementById('newOrderSection').style.display = 'none';
    }
}

// العداد التنازلي
function startCountdown() {
    countdownSeconds = 60;
    const fill = document.getElementById('countdownFill');
    const num  = document.getElementById('countdownNum');

    clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        countdownSeconds--;
        num.textContent  = countdownSeconds;
        fill.style.width = `${(countdownSeconds / 60) * 100}%`;

        if (countdownSeconds <= 0) {
            clearInterval(countdownInterval);
            rejectOrder();
        }
    }, 1000);
}

// قبول الطلب
function acceptOrder() {
    clearInterval(countdownInterval);
    document.getElementById('newOrderSection').style.display = 'none';

    const savedOrder = localStorage.getItem('yashjub_order');
    if (savedOrder) {
        const order = JSON.parse(savedOrder);
        const net   = Math.round(order.price * 0.95);

        // تحديث الإحصائيات
        const current = parseInt(document.getElementById('statToday').textContent) || 0;
        document.getElementById('statToday').textContent = current + 1;

        alert(`✅ تم قبول الطلب!\n\nتوجه للموقع المحدد:\n📍 ${order.address}\n\nصافي أرباحك: ${net} ريال`);
        localStorage.removeItem('yashjub_order');

        // تحديث الصفحة
        loadProvider();
    }
}

// رفض الطلب
function rejectOrder() {
    clearInterval(countdownInterval);
    document.getElementById('newOrderSection').style.display = 'none';
    localStorage.removeItem('yashjub_order');
}

// تأكيد اكتمال الطلب
async function completeOrder(id) {
    if (!confirm('هل اكتملت الخدمة؟')) return;

    try {
        await fetch(`${API}/orders/${id}/status`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ status: 'completed' })
        });

        alert('✅ تم تأكيد اكتمال الخدمة!');
        loadProvider();
    } catch(e) {
        alert('❌ خطأ في الاتصال');
    }
}

// تغيير حالة التوفر
function toggleAvailability() {
    const toggle = document.getElementById('availToggle');
    const label  = document.getElementById('availLabel');

    if (toggle.checked) {
        label.textContent    = 'متاح';
        label.style.color    = '#10B981';
    } else {
        label.textContent    = 'مشغول';
        label.style.color    = '#EF4444';
        clearInterval(countdownInterval);
        document.getElementById('newOrderSection').style.display = 'none';
    }
}

// طلب سحب
function requestWithdraw() {
    const balance = document.getElementById('walletBalance').textContent;
    alert(`💳 طلب سحب\n\nالرصيد المتاح: ${balance}\n\nسيتم تحويل المبلغ لحسابك البنكي خلال 24-72 ساعة`);
}

// تسجيل الخروج
function providerLogout() {
    localStorage.removeItem('yashjub_phone');
    localStorage.removeItem('yashjub_type');
    window.location.href = 'index.html';
}

// السايد بار
function toggleSidebar() {
    document.getElementById('appSidebar').classList.toggle('active');
    document.getElementById('sidebarOverlay').classList.toggle('active');
}

// تشغيل
loadProvider();