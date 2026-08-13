// كود صفحة الطلب

const API = window.location.origin + '/api';

const servicesData = {
    "وايت ماء": { icon: "🚚", type: "فوري",   price: 200,  time: "8 دقائق"        },
    "سطحة":     { icon: "🚛", type: "فوري",   price: 250,  time: "12 دقيقة"       },
    "حاوية":    { icon: "📦", type: "مجدول", price: 0,    time: "غداً 11 صباحاً" },
}

let currentService   = '';
let selectedProduct  = null;
let addressMap       = null;
let addressMarker    = null;

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
        const productRaw = localStorage.getItem('yashjub_selected_product');
        if (!productRaw) {
            window.location.href = 'container-location.html';
            return;
        }
        selectedProduct = JSON.parse(productRaw);

        document.getElementById('containerSection').style.display = 'block';
        document.getElementById('containerPriceRow').style.display = 'flex';
        document.getElementById('containerDaysRow').style.display  = 'flex';
        document.getElementById('timeField').style.display         = 'none';

        const sizeNames = { small: 'صغيرة (3م)', medium: 'متوسطة (6م)', large: 'كبيرة (12م)' };

        document.getElementById('selectedProviderText').textContent =
            `📦 ${selectedProduct.providerName} — ⭐ ${selectedProduct.providerRating}`;

        document.getElementById('productName').textContent        = selectedProduct.name;
        document.getElementById('productDescription').textContent = selectedProduct.description || '';
        document.getElementById('productSize').textContent         = sizeNames[selectedProduct.size] || selectedProduct.size;
        document.getElementById('productPrice').textContent        = selectedProduct.price;
        document.getElementById('productMinDaysText').textContent  = selectedProduct.minDays;

        // ضبط الحد الأدنى للأيام حسب المنتج المختار
        document.getElementById('minDaysLabel').textContent = selectedProduct.minDays;
        document.getElementById('daysCount').min   = selectedProduct.minDays;
        document.getElementById('daysCount').value = selectedProduct.minDays;

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

    initAddressMap();
}

// ══ خريطة تحديد الموقع ══

function initAddressMap() {
    addressMap = L.map('addressMap').setView([24.7136, 46.6753], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
    }).addTo(addressMap);

    addressMap.on('click', (e) => {
        setAddressMarker(e.latlng.lat, e.latlng.lng);
    });
}

function setAddressMarker(lat, lng) {
    if (addressMarker) {
        addressMarker.setLatLng([lat, lng]);
    } else {
        addressMarker = L.marker([lat, lng]).addTo(addressMap);
    }

    document.getElementById('addressLat').value = lat;
    document.getElementById('addressLng').value = lng;

    reverseGeocode(lat, lng);
}

async function reverseGeocode(lat, lng) {
    document.getElementById('address').value = 'جاري تحديد اسم الموقع...';

    try {
        const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`);
        const data = await res.json();
        document.getElementById('address').value = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch (error) {
        document.getElementById('address').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
}

// استخدام الموقع الحالي عبر GPS
function useMyLocation() {
    if (!navigator.geolocation) {
        alert('❌ المتصفح ما يدعم تحديد الموقع');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            addressMap.setView([latitude, longitude], 15);
            setAddressMarker(latitude, longitude);
        },
        () => {
            alert('❌ ما قدرنا نحدد موقعك — تأكد من تفعيل صلاحية الموقع بالمتصفح');
        }
    );
}

// تحديث السعر العادي
function updateNormalPrice(price) {
    const fee = Math.round(price * 0.05);
    const total = price + fee;
    document.getElementById('servicePrice').textContent = `${price} ريال`;
    document.getElementById('platformFee').textContent  = `${fee} ريال`;
    document.getElementById('totalPrice').textContent   = `${total} ريال`;
}

// تغيير عدد الأيام
function changeDays(delta) {
    const minDays = selectedProduct ? selectedProduct.minDays : 10;
    const input   = document.getElementById('daysCount');
    const current = parseInt(input.value) || minDays;
    const newVal  = Math.max(minDays, current + delta);
    input.value   = newVal;
    updateEndDate();
    updateContainerPrice();
}

// تحديث تاريخ النهاية
function updateEndDate() {
    const minDays   = selectedProduct ? selectedProduct.minDays : 10;
    const startDate = document.getElementById('startDate').value;
    const days      = parseInt(document.getElementById('daysCount').value) || minDays;

    if (startDate) {
        const end = new Date(startDate);
        end.setDate(end.getDate() + days);
        document.getElementById('endDate').value = end.toISOString().split('T')[0];
    }
    updateContainerPrice();
}

// تحديث سعر الحاوية (السعر يُحسب خطياً من سعر الحزمة: سعر الحزمة ÷ حد أدنى الأيام × عدد الأيام الفعلي)
function updateContainerPrice() {
    if (!selectedProduct) return;

    const minDays = selectedProduct.minDays;
    const days    = parseInt(document.getElementById('daysCount').value) || minDays;

    if (days < minDays) {
        document.getElementById('daysCount').value = minDays;
        return;
    }

    const dailyRate = selectedProduct.price / minDays;
    const totalBase = Math.round(dailyRate * days);
    const fee       = Math.round(totalBase * 0.05);
    const total     = totalBase + fee;

    document.getElementById('containerDailyPrice').textContent = `${selectedProduct.price} ريال / ${minDays} أيام`;
    document.getElementById('containerDaysLabel').textContent  = `${days} يوم`;
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
        const minDays = selectedProduct.minDays;
        const days    = parseInt(document.getElementById('daysCount').value) || minDays;
        const start   = document.getElementById('startDate').value;
        const end     = document.getElementById('endDate').value;

        if (days < minDays) {
            alert(`❌ الحد الأدنى للإيجار ${minDays} أيام`);
            return;
        }

        const dailyRate = selectedProduct.price / minDays;
        finalPrice  = Math.round(dailyRate * days);
        fullAddress = `${address} | ${selectedProduct.name} | من: ${start} إلى: ${end} (${days} يوم)`;
    }

    const lat = document.getElementById('addressLat').value || null;
    const lng = document.getElementById('addressLng').value || null;

    try {
        const response = await fetch(`${API}/orders`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                phone,
                service:      currentService,
                address:      fullAddress,
                price:        finalPrice,
                providerId:   selectedProduct ? selectedProduct.providerId   : null,
                providerName: selectedProduct ? selectedProduct.providerName : null,
                productId:    selectedProduct ? selectedProduct.id           : null,
                lat, lng,
            })
        });

        const data = await response.json();

        if (data.success) {
            const order = data.order;

            localStorage.setItem('yashjub_order', JSON.stringify({
                id:             order.id,
                service:        currentService,
                icon:           service.icon,
                address:        fullAddress,
                status:         order.status,
                time:           service.time,
                price:          finalPrice,
                createdAt:      new Date().toLocaleString('ar-SA'),
                providerName:   order.provider_name,
                providerPhone:  order.provider_phone,
                providerRating: order.provider_rating,
                lat:            order.lat,
                lng:            order.lng,
            }));

            localStorage.removeItem('yashjub_selected_product');
            localStorage.removeItem('yashjub_container_location');

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