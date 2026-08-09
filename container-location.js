// كود خطوة اختيار الموقع (حاوية)

(function checkLogin() {
    const phone = localStorage.getItem('yashjub_phone');
    if (!phone) {
        alert("⚠️ يجب تسجيل الدخول أولاً!");
        window.location.href = 'login.html';
    }
})();

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
