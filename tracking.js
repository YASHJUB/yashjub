// كود تتبع الطلب في يشجب

// تحميل بيانات الطلب
function loadOrder() {
    const orderData = localStorage.getItem('yashjub_order');

    if (!orderData) {
        window.location.href = 'index.html';
        return;
    }

    const order = JSON.parse(orderData);

    // تحديث الصفحة ببيانات الطلب
    document.getElementById('trackingIcon').textContent   = order.icon;
    document.getElementById('trackingService').textContent = order.service;
    document.getElementById('orderNumber').textContent    = `#${order.id}`;
    document.getElementById('trackingAddress').textContent = order.address;
    document.getElementById('trackingTime').textContent   = order.time;
    document.getElementById('trackingPrice').textContent  = `${order.price} ريال`;
    document.getElementById('trackingDate').textContent   = order.createdAt;

    // تشغيل محاكاة التتبع
    simulateTracking();
}

// محاكاة مراحل الطلب
function simulateTracking() {

    // بعد 3 ثواني — تم إيجاد مزود
    setTimeout(() => {
        document.getElementById('line2').classList.add('done');
        document.getElementById('step3').classList.add('active');
        document.getElementById('step3').classList.remove('step');
        document.querySelector('#step2 .step-icon').textContent = '✅';
    }, 3000);

    // بعد 6 ثواني — المزود في الطريق
    setTimeout(() => {
        document.getElementById('line3').classList.add('done');
        document.getElementById('step4').classList.add('active');
        document.querySelector('#step3 .step-icon').textContent = '✅';
    }, 6000);

    // بعد 10 ثواني — تم التوصيل
    setTimeout(() => {
        document.querySelector('#step4 .step-icon').textContent = '✅';
        document.querySelector('#step4 .step-sub').textContent  = 'اكتملت الخدمة بنجاح 🎉';
        showComplete();
    }, 10000);
}

// إظهار رسالة الاكتمال
function showComplete() {
    setTimeout(() => {
        alert('🎉 تم اكتمال الخدمة بنجاح!\nشكراً لاستخدامك يشجب');
        localStorage.removeItem('yashjub_order');
        window.location.href = 'index.html';
    }, 1000);
}

// إلغاء الطلب
function cancelOrder() {
    if (confirm('هل أنت متأكد من إلغاء الطلب؟')) {
        localStorage.removeItem('yashjub_order');
        alert('تم إلغاء الطلب ✅');
        window.location.href = 'index.html';
    }
}

// تشغيل عند فتح الصفحة
loadOrder();