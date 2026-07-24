// كود صفحة الطلب — متصل بالسيرفر

const API = window.location.origin + '/api';

const servicesData = {
    "وايت ماء": { icon: "🚚", type: "فوري",   price: 200, time: "8 دقائق"        },
    "سطحة":     { icon: "🚛", type: "فوري",   price: 250, time: "12 دقيقة"       },
    "حاوية":    { icon: "📦", type: "مجدول", price: 350, time: "غداً 11 صباحاً" },
}

function loadService() {
    const phone = localStorage.getItem('yashjub_phone');
    if (!phone) {
        alert("⚠️ يجب تسجيل الدخول أولاً!");
        window.location.href = 'login.html';
        return;
    }

    const params      = new URLSearchParams(window.location.search);
    const serviceName = params.get('service');

    if (!serviceName || !servicesData[serviceName]) {
        window.location.href = 'index.html';
        return;
    }

    const service = servicesData[serviceName];

    document.getElementById('orderIcon').textContent  = service.icon;
    document.getElementById('orderTitle').textContent = serviceName;
    document.getElementById('orderType').textContent  = service.type;

    const fee   = Math.round(service.price * 0.07);
    const total = service.price + fee;

    document.getElementById('servicePrice').textContent = `${service.price} ريال`;
    document.getElementById('platformFee').textContent  = `${fee} ريال`;
    document.getElementById('totalPrice').textContent   = `${total} ريال`;

    if (service.type === 'فوري') {
        document.getElementById('timeField').style.display = 'none';
    }

    // إظهار حقل موقع التوصيل للسطحة فقط
    if (serviceName === 'سطحة') {
        document.getElementById('deliveryField').style.display = 'block';
        document.getElementById('addressLabel').textContent = '📍 موقع السيارة الحالي';
    } else {
        document.getElementById('deliveryField').style.display = 'none';
        document.getElementById('addressLabel').textContent = '📍 موقع التوصيل';
    }
}

async function confirmOrder() {
    const address  = document.getElementById('address').value;
    const phone    = localStorage.getItem('yashjub_phone');
    const params   = new URLSearchParams(window.location.search);
    const serviceName = params.get('service');
    const service  = servicesData[serviceName];

    if (!address) {
        alert("❌ يرجى إدخال الموقع");
        return;
    }

    // التحقق من موقع التوصيل للسطحة
    let deliveryAddress = '';
    if (serviceName === 'سطحة') {
        deliveryAddress = document.getElementById('deliveryAddress').value;
        if (!deliveryAddress) {
            alert("❌ يرجى إدخال موقع التوصيل");
            return;
        }
    }

    const fullAddress = serviceName === 'سطحة'
        ? `من: ${address} — إلى: ${deliveryAddress}`
        : address;

    try {
        const response = await fetch(`${API}/orders`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                phone,
                service:  serviceName,
                address:  fullAddress,
                price:    service.price,
            })
        });

        const data = await response.json();

        if (data.success) {
            const order = data.order;

            localStorage.setItem('yashjub_order', JSON.stringify({
                id:        order.id,
                service:   serviceName,
                icon:      service.icon,
                address:   fullAddress,
                status:    order.status,
                time:      service.time,
                price:     order.price,
                createdAt: new Date().toLocaleString('ar-SA'),
            }));

            alert(`✅ تم تأكيد طلبك!\n\nرقم الطلب: #${order.id}\n${service.icon} ${serviceName}\n📍 ${fullAddress}`);
            window.location.href = 'tracking.html';
        } else {
            alert(`❌ ${data.message}`);
        }

    } catch (error) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

function goBack() {
    window.location.href = 'index.html';
}

loadService();