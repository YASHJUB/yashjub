// كود صفحة الطلب

const API = window.location.origin + '/api';

const servicesData = {
    "وايت ماء": { icon: "🚚", type: "فوري",   price: 200,  time: "8 دقائق"        },
    "سطحة":     { icon: "🚛", type: "فوري",   price: 250,  time: "12 دقيقة"       },
    "حاوية":    { icon: "📦", type: "مجدول", price: 0,    time: "غداً 11 صباحاً" },
}

let selectedSize      = null;
let selectedDayPrice  = 0;
let currentService    = '';

function loadService() {
    const phone = localStorage.getItem('yashjub_phone');
    if (!phone) {
        alert("⚠️ يجب تسجيل الدخول أولاً!");
        window.location.href = 'login.html';
        return;
    }

    const params      = new URLSearchParams(window.location.search);
    const serviceName = params.get('service');
    currentService    = serviceName;

    if (!serviceName || !servicesData[serviceName]) {
        window.location.href = 'index.html';
        return;
    }

    const service = servicesData[serviceName];

    document.getElementById('orderIcon').textContent  = service.icon;
    document.getElementById('orderTitle').textContent = serviceName;
    document.getElementById('orderType').textContent  = service.type;

    // إخفاء حقل الوقت للفوري
    if (service.type === 'فوري') {
        document.getElementById('timeField').style.display = 'none';
    }

    // السطحة — حقل التوصيل
    if (serviceName === 'سطحة') {
        document.getElementById('deliveryField').style.display = 'block';
        document.getElementById('addressLabel').textContent    = '📍 موقع السيارة الحالي';
    }

    // الحاوية — قسم خاص
    if (serviceName === 'حاوية') {
        document.getElementById('containerSection').style.display = 'block';
        document.getElementById('containerPriceRow').style.display = 'flex';
        document.getElementById('containerDaysRow').style.display  = 'flex';
        document.getElementById('timeField').style.display         = 'none';

        // تعيين تاريخ اليوم كحد أدنى
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('startDate').value = today;
        document.getElementById('startDate').min   = today;
        updateEndDate();
        updateContainerPrice();
    } else {
        // تحديث السعر للخدمات العادية
        updateNormalPrice(service.price);
    }
}

// تحديث السعر العادي
function updateNormalPrice(price) {
    const fee = Math.round(price * 0.05);
    const total = price + fee;
    document.getElementById('servicePrice').textContent = `${price} ريال`;
    document.getElementById('platformFee').textContent  = `${fee} ريال`;
    document.getElementById('totalPrice').textContent   = `${total} ريال`;
}

// اختيار حجم الحاوية
function selectSize(size, pricePerDay) {
    selectedSize     = size;
    selectedDayPrice = pricePerDay;

    // إزالة التحديد من الكل
    document.querySelectorAll('.size-card').forEach(c => c.classList.remove('selected'));
    document.getElementById(`size-${size}`).classList.add('selected');

    updateContainerPrice();
}

// تغيير عدد الأيام
function changeDays(delta) {
    const input   = document.getElementById('daysCount');
    const current = parseInt(input.value) || 10;
    const newVal  = Math.max(10, current + delta);
    input.value   = newVal;
    updateEndDate();
    updateContainerPrice();
}

// تحديث تاريخ النهاية
function updateEndDate() {
    const startDate = document.getElementById('startDate').value;
    const days      = parseInt(document.getElementById('daysCount').value) || 10;

    if (startDate) {
        const end = new Date(startDate);
        end.setDate(end.getDate() + days);
        document.getElementById('endDate').value = end.toISOString().split('T')[0];
    }
    updateContainerPrice();
}

// تحديث سعر الحاوية
function updateContainerPrice() {
    const days = parseInt(document.getElementById('daysCount').value) || 10;

    if (days < 10) {
        document.getElementById('daysCount').value = 10;
        return;
    }

    if (!selectedDayPrice) {
        document.getElementById('servicePrice').textContent = '0 ريال';
        document.getElementById('platformFee').textContent  = '0 ريال';
        document.getElementById('totalPrice').textContent   = '0 ريال';
        return;
    }

    const totalBase = selectedDayPrice * days;
   const fee = Math.round(totalBase * 0.05);
    const total     = totalBase + fee;

    const sizeNames = { small: 'صغيرة', medium: 'متوسطة', large: 'كبيرة' };

    document.getElementById('containerDailyPrice').textContent = `${selectedDayPrice} ريال/يوم`;
    document.getElementById('containerDaysLabel').textContent  = `${days} يوم × ${selectedDayPrice} ريال`;
    document.getElementById('containerDaysValue').textContent  = `${totalBase} ريال`;
    document.getElementById('servicePrice').textContent        = `${totalBase} ريال`;
    document.getElementById('platformFee').textContent         = `${fee} ريال`;
    document.getElementById('totalPrice').textContent          = `${total} ريال`;
}

// تأكيد الطلب
async function confirmOrder() {
    const address     = document.getElementById('address').value;
    const phone       = localStorage.getItem('yashjub_phone');
    const service     = servicesData[currentService];

    if (!address) {
        alert("❌ يرجى إدخال الموقع");
        return;
    }

    // التحقق من السطحة
    let fullAddress = address;
    if (currentService === 'سطحة') {
        const delivery = document.getElementById('deliveryAddress').value;
        if (!delivery) {
            alert("❌ يرجى إدخال موقع التوصيل");
            return;
        }
        fullAddress = `من: ${address} — إلى: ${delivery}`;
    }

    // التحقق من الحاوية
    let finalPrice = service.price;
    if (currentService === 'حاوية') {
        if (!selectedSize) {
            alert("❌ يرجى اختيار حجم الحاوية");
            return;
        }
        const days  = parseInt(document.getElementById('daysCount').value) || 10;
        const start = document.getElementById('startDate').value;
        const end   = document.getElementById('endDate').value;

        if (days < 10) {
            alert("❌ الحد الأدنى للإيجار 10 أيام");
            return;
        }

        finalPrice  = selectedDayPrice * days;
        const sizeNames = { small: 'صغيرة', medium: 'متوسطة', large: 'كبيرة' };
        fullAddress = `${address} | حجم: ${sizeNames[selectedSize]} | من: ${start} إلى: ${end} (${days} يوم)`;
    }

    try {
        const response = await fetch(`${API}/orders`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                phone,
                service:  currentService,
                address:  fullAddress,
                price:    finalPrice,
            })
        });

        const data = await response.json();

        if (data.success) {
            const order = data.order;

            localStorage.setItem('yashjub_order', JSON.stringify({
                id:        order.id,
                service:   currentService,
                icon:      service.icon,
                address:   fullAddress,
                status:    order.status,
                time:      service.time,
                price:     finalPrice,
                createdAt: new Date().toLocaleString('ar-SA'),
            }));

            alert(`✅ تم تأكيد طلبك!\n\nرقم الطلب: #${order.id}\n${service.icon} ${currentService}\n📍 ${address}`);
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