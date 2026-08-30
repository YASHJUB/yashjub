// كود صفحة الطلب

const API = window.location.origin + '/api';

const SERVICE_BADGE_LABELS = { instant: 'فوري', scheduled: 'مجدول', coming: 'قريباً' };

let servicesData      = {};
let currentService    = '';
let selectedProduct   = null;
let addressMap        = null;
let addressMarker     = null;
let appliedCoupon     = null;

// تحميل كتالوج الخدمات من السيرفر (اسم الخدمة → icon/type/minPrice/time)
async function loadServicesData() {
    try {
        const res  = await fetch(`${API}/services/active`);
        const data = await res.json();
        if (!data.success) return;

        data.services.forEach(s => {
            servicesData[s.name] = {
                icon:     s.icon,
                type:     SERVICE_BADGE_LABELS[s.badge_type] || s.badge_type,
                minPrice: s.min_price,
                time:     s.time_estimate,
            };
        });
    } catch (e) {}
}

async function loadService() {
    const phone = localStorage.getItem('yashjub_phone');
    if (!phone) {
        alert("⚠️ يجب تسجيل الدخول أولاً!");
        window.location.href = 'login.html';
        return;
    }

    await loadServicesData();

    const params      = new URLSearchParams(window.location.search);
    const serviceName = params.get('service');
    currentService    = serviceName;

    if (!serviceName || !servicesData[serviceName]) {
        window.location.href = 'index.html';
        return;
    }

    const service = servicesData[serviceName];

    document.getElementById('orderIcon').innerHTML = `<svg class="icon"><use href="icons.svg#icon-${service.icon}"></use></svg>`;
    document.getElementById('orderTitle').textContent = serviceName;
    document.getElementById('orderType').textContent  = service.type;

    // إخفاء حقل الوقت للفوري
    if (service.type === 'فوري') {
        document.getElementById('timeField').style.display = 'none';
    }

    // السطحة — حقل التوصيل
    if (serviceName === 'سطحة') {
        document.getElementById('deliveryField').style.display = 'block';
        document.getElementById('addressLabel').innerHTML    = '<svg class="icon"><use href="icons.svg#icon-pin"></use></svg> موقع السيارة الحالي';
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

        document.getElementById('selectedProviderText').innerHTML =
            `<svg class="icon"><use href="icons.svg#icon-box"></use></svg> ${selectedProduct.providerName} — <svg class="icon"><use href="icons.svg#icon-star"></use></svg> ${selectedProduct.providerRating}`;

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
        // وايت ماء / سطحة — العميل يحدد سعره بنفسه
        document.getElementById('customPriceSection').style.display = 'block';
        document.getElementById('customPrice').min = service.minPrice;
        document.getElementById('servicePriceLabel').textContent = 'السعر المحدد';
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

// حساب قيمة الخصم لسعر معيّن حسب الكوبون المطبّق (نفس منطق السيرفر بالضبط)
function computeDiscount(baseAmount) {
    if (!appliedCoupon || !baseAmount) return 0;

    let discount = appliedCoupon.type === 'percent'
        ? Math.round(baseAmount * (appliedCoupon.value / 100))
        : Math.round(appliedCoupon.value);

    if (appliedCoupon.maxDiscount && discount > appliedCoupon.maxDiscount) discount = Math.round(appliedCoupon.maxDiscount);
    if (discount > baseAmount) discount = baseAmount;

    return Math.max(0, discount);
}

function updateDiscountRow(discount) {
    const row = document.getElementById('discountRow');
    if (discount > 0) {
        row.style.display = 'flex';
        document.getElementById('discountValue').textContent = `-${discount} ريال`;
    } else {
        row.style.display = 'none';
    }
}

// تطبيق كود الخصم
async function applyCouponCode() {
    const codeInput = document.getElementById('couponCodeInput');
    const code      = codeInput.value.trim();
    const msgEl     = document.getElementById('couponMessage');

    if (!code) {
        appliedCoupon = null;
        msgEl.style.display = 'none';
        recalcCurrentPrice();
        return;
    }

    const baseAmount = getCurrentBasePrice();

    try {
        const res  = await fetch(`${API}/coupons/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, amount: baseAmount }),
        });
        const data = await res.json();

        if (data.success) {
            appliedCoupon = { code: code.toUpperCase(), type: data.discountType, value: data.discountValue, maxDiscount: data.maxDiscount };
            msgEl.textContent   = `تم تطبيق الكود — خصم ${data.discount} ريال`;
            msgEl.style.color   = 'var(--green)';
            msgEl.style.display = 'block';
        } else {
            appliedCoupon = null;
            msgEl.textContent   = `❌ ${data.message}`;
            msgEl.style.color   = 'var(--red)';
            msgEl.style.display = 'block';
        }
    } catch (e) {
        appliedCoupon = null;
        msgEl.textContent   = '❌ تعذّر التحقق من الكود';
        msgEl.style.color   = 'var(--red)';
        msgEl.style.display = 'block';
    }

    recalcCurrentPrice();
}

// السعر الأساسي الحالي (قبل الخصم وقبل رسوم الخدمة) حسب نوع الخدمة
function getCurrentBasePrice() {
    if (currentService === 'حاوية') {
        if (!selectedProduct) return 0;
        const minDays   = selectedProduct.minDays;
        const days      = parseInt(document.getElementById('daysCount').value) || minDays;
        const dailyRate = selectedProduct.price / minDays;
        return Math.round(dailyRate * days);
    }

    const val = parseFloat(document.getElementById('customPrice').value);
    return val > 0 ? val : 0;
}

function recalcCurrentPrice() {
    if (currentService === 'حاوية') {
        updateContainerPrice();
    } else {
        updateCustomPrice();
    }
}

// تحديث السعر العادي
function updateNormalPrice(price) {
    const discount      = computeDiscount(price);
    const afterDiscount = price - discount;
    const fee           = Math.round(afterDiscount * 0.05);
    const total         = afterDiscount + fee;

    document.getElementById('servicePrice').textContent = `${price} ريال`;
    document.getElementById('platformFee').textContent  = `${fee} ريال`;
    document.getElementById('totalPrice').textContent   = `${total} ريال`;
    updateDiscountRow(discount);
}

// تحديث السعر اللي يحدده العميل (وايت ماء / سطحة)
function updateCustomPrice() {
    const service   = servicesData[currentService];
    const input     = document.getElementById('customPrice');
    const errorText = document.getElementById('priceErrorText');
    const price     = parseFloat(input.value);

    if (input.value && price < service.minPrice) {
        errorText.innerHTML   = `<svg class="icon"><use href="icons.svg#icon-x-circle"></use></svg> الحد الأدنى ${service.minPrice} ريال`;
        errorText.style.display = 'block';
    } else {
        errorText.style.display = 'none';
    }

    updateNormalPrice(price > 0 ? price : 0);
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
    const discount  = computeDiscount(totalBase);
    const afterDiscount = totalBase - discount;
    const fee       = Math.round(afterDiscount * 0.05);
    const total     = afterDiscount + fee;

    document.getElementById('containerDailyPrice').textContent = `${selectedProduct.price} ريال / ${minDays} أيام`;
    document.getElementById('containerDaysLabel').textContent  = `${days} يوم`;
    document.getElementById('containerDaysValue').textContent  = `${totalBase} ريال`;
    document.getElementById('servicePrice').textContent        = `${totalBase} ريال`;
    document.getElementById('platformFee').textContent         = `${fee} ريال`;
    document.getElementById('totalPrice').textContent          = `${total} ريال`;
    updateDiscountRow(discount);
}

// تأكيد الطلب — يجهّز البيانات ويفتح نافذة العد التنازلي
function confirmOrder() {
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

    let finalPrice = 0;

    // التحقق من الحاوية
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

    // وايت ماء / سطحة — السعر اللي حدده العميل
    } else {
        const customPrice = parseFloat(document.getElementById('customPrice').value);

        if (!customPrice || customPrice < service.minPrice) {
            alert(`❌ الحد الأدنى ${service.minPrice} ريال`);
            return;
        }

        finalPrice = customPrice;
    }

    const lat = document.getElementById('addressLat').value || null;
    const lng = document.getElementById('addressLng').value || null;

    const discount = computeDiscount(finalPrice);

    // تجهيز بيانات الطلب لحين انتهاء العد التنازلي
    pendingOrder = {
        payload: {
            phone,
            service:      currentService,
            address:      fullAddress,
            price:        finalPrice,
            couponCode:   appliedCoupon ? appliedCoupon.code : null,
            providerId:   selectedProduct ? selectedProduct.providerId   : null,
            providerName: selectedProduct ? selectedProduct.providerName : null,
            productId:    selectedProduct ? selectedProduct.id           : null,
            lat, lng,
        },
        service, fullAddress, address,
        finalPrice: finalPrice - discount,
        discount,
    };

    openConfirmOverlay();
}

// ══ نافذة تأكيد الطلب (عد تنازلي 7 ثواني) ══

let pendingOrder      = null;
let confirmInterval   = null;
let confirmSecondsLeft = 7;

function openConfirmOverlay() {
    document.getElementById('confirmService').textContent = pendingOrder.service.icon + ' ' + currentService;
    document.getElementById('confirmAddress').textContent = pendingOrder.fullAddress;
    document.getElementById('confirmAmount').textContent  = pendingOrder.discount > 0
        ? `${pendingOrder.finalPrice} ريال (بعد خصم ${pendingOrder.discount} ريال)`
        : `${pendingOrder.finalPrice} ريال`;

    document.getElementById('confirmOverlay').style.display  = 'flex';
    document.getElementById('confirmCancelBtn').style.display = 'block';

    confirmSecondsLeft = 7;
    document.getElementById('confirmCountdownNum').textContent = confirmSecondsLeft;

    const fill = document.getElementById('confirmProgressFill');
    fill.style.transition = 'none';
    fill.style.width      = '100%';
    void fill.offsetWidth; // إجبار المتصفح يطبّق العرض قبل بدء الانتقال
    fill.style.transition = 'width 7s linear';
    fill.style.width      = '0%';

    clearInterval(confirmInterval);
    confirmInterval = setInterval(() => {
        confirmSecondsLeft--;
        document.getElementById('confirmCountdownNum').textContent = Math.max(confirmSecondsLeft, 0);

        if (confirmSecondsLeft <= 0) {
            clearInterval(confirmInterval);
            document.getElementById('confirmCancelBtn').style.display = 'none';
            submitPendingOrder();
        }
    }, 1000);
}

// إلغاء التأكيد أثناء العد التنازلي
function cancelConfirmation() {
    clearInterval(confirmInterval);
    document.getElementById('confirmOverlay').style.display = 'none';
    pendingOrder = null;
}

// إرسال الطلب فعلياً بعد انتهاء العد التنازلي
async function submitPendingOrder() {
    if (!pendingOrder) return;

    const { payload, service, fullAddress } = pendingOrder;

    try {
        const response = await fetch(`${API}/orders`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload)
        });

        const data = await response.json();

        document.getElementById('confirmOverlay').style.display = 'none';

        if (data.success) {
            const order = data.order;

            localStorage.setItem('yashjub_order', JSON.stringify({
                id:             order.id,
                service:        currentService,
                icon:           service.icon,
                address:        fullAddress,
                status:         order.status,
                time:           service.time,
                price:          order.price,
                createdAt:      new Date().toLocaleString('ar-SA'),
                providerName:   order.provider_name,
                providerPhone:  order.provider_phone,
                providerRating: order.provider_rating,
                lat:            order.lat,
                lng:            order.lng,
            }));

            localStorage.removeItem('yashjub_selected_product');
            localStorage.removeItem('yashjub_container_location');

            window.location.href = 'tracking.html';
        } else {
            alert(`❌ ${data.message}`);
        }

    } catch (error) {
        document.getElementById('confirmOverlay').style.display = 'none';
        alert('❌ خطأ في الاتصال بالسيرفر');
    } finally {
        pendingOrder = null;
    }
}

function goBack() {
    window.location.href = 'index.html';
}

loadService();