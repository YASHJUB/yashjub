// كود صفحة الطلب — متصل بالسيرفر

const API = window.location.origin + '/api';
const servicesData = {
    "وايت ماء": { icon: "🚚", type: "فوري",   price: 200, time: "8 دقائق"        },
    "سطحة":     { icon: "🚛", type: "فوري",   price: 250, time: "12 دقيقة"       },
    "بوكلين":   { icon: "🏗️", type: "مجدول", price: 800, time: "غداً 9 صباحاً"  },
    "حاوية":    { icon: "📦", type: "مجدول", price: 350, time: "غداً 11 صباحاً" },
    "عمالة":    { icon: "👷", type: "مجدول", price: 500, time: "غداً 8 صباحاً"  },
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
}

async function confirmOrder() {
    const address     = document.getElementById('address').value;
    const phone       = localStorage.getItem('yashjub_phone');
    const params      = new URLSearchParams(window.location.search);
    const serviceName = params.get('service');
    const service     = servicesData[serviceName];

    if (!address) {
        alert("❌ يرجى إدخال موقع التوصيل");
        return;
    }

    try {
        // إرسال الطلب للسيرفر
        const response = await fetch(`${API}/orders`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                phone,
                service:  serviceName,
                address,
                price:    service.price,
            })
        });

        const data = await response.json();

        if (data.success) {
            const order = data.order;

            // حفظ الطلب محلياً للتتبع
            localStorage.setItem('yashjub_order', JSON.stringify({
                id:        order.id,
                service:   serviceName,
                icon:      service.icon,
                address:   order.address,
                status:    order.status,
                time:      service.time,
                price:     order.price,
                createdAt: new Date().toLocaleString('ar-SA'),
            }));

            alert(`✅ تم تأكيد طلبك!\n\nرقم الطلب: #${order.id}\n${service.icon} ${serviceName}\n📍 ${address}`);
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