// كود صفحة طلباتي

const API = window.location.origin + '/api';

const serviceIcons = {
    'وايت ماء':    '🚚',
    'سطحة':        '🚛',
    'معدات ثقيلة': '🏗️',
    'حاوية':       '📦',
    'عمالة':       '👷',
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
            const icon   = serviceIcons[order.service] || '🔧';
            const status = statusLabels[order.status]  || { label: order.status, color: '#888', bg: '#f0f0f0' };
            const date   = new Date(order.created_at).toLocaleDateString('ar-SA');

            return `
                <div class="order-card-item">
                    <div class="order-card-top">
                        <div class="order-card-service">
                            <div class="order-card-icon">${icon}</div>
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
                            <span class="order-detail-label">📍 الموقع</span>
                            <span class="order-detail-value">${order.address}</span>
                        </div>
                        <div class="order-detail">
                            <span class="order-detail-label">💰 المبلغ</span>
                            <span class="order-detail-value">${order.price} ريال</span>
                        </div>
                        <div class="order-detail">
                            <span class="order-detail-label">🧾 رقم الطلب</span>
                            <span class="order-detail-value">#${order.id}</span>
                        </div>
                    </div>
                    ${order.status === 'pending' ? `
                    <button class="btn-cancel" onclick="cancelOrder(${order.id})">
                        إلغاء الطلب ❌
                    </button>` : ''}
                </div>
            `;
        }).join('');

    } catch (error) {
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('emptyState').style.display   = 'block';
    }
}

// إلغاء طلب
async function cancelOrder(id) {
    if (!confirm('هل أنت متأكد من إلغاء الطلب؟')) return;

    try {
        const response = await fetch(`${API}/orders/${id}/status`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ status: 'cancelled' })
        });

        const data = await response.json();

        if (data.success) {
            alert('✅ تم إلغاء الطلب');
            loadOrders();
        }

    } catch (error) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// تشغيل عند فتح الصفحة
loadOrders();