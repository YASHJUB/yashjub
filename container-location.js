// كود خطوة اختيار الموقع (حاوية)

const API = window.location.origin + '/api';

(function checkLogin() {
    const phone = localStorage.getItem('yashjub_phone');
    if (!phone) {
        alert("⚠️ يجب تسجيل الدخول أولاً!");
        window.location.href = 'login.html';
    }
})();

// تحميل المدن المتاحة من لوحة الإدارة
async function loadCities() {
    const select = document.getElementById('city');
    try {
        const res  = await fetch(`${API}/cities/active`);
        const data = await res.json();

        if (data.success && data.cities.length) {
            select.innerHTML = '<option value="">اختر المدينة</option>' +
                data.cities.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        }
    } catch (e) {
        // تعذّر التحميل — يبقى الخيار الافتراضي بالـ HTML كما هو
    }
}

loadCities();

function goToProviders() {
    const city         = document.getElementById('city').value;
    const neighborhood = document.getElementById('neighborhood').value.trim();

    if (!city) {
        alert('❌ يرجى اختيار المدينة');
        return;
    }

    if (!neighborhood) {
        alert('❌ يرجى إدخال اسم الحي');
        return;
    }

    localStorage.setItem('yashjub_container_location', JSON.stringify({ city, neighborhood }));

    window.location.href = 'container-providers.html';
}
