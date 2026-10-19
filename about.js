// كود صفحة "من نحن" — محتوى مختلف بوضع الإعلانات (منصة غوث معاهدة)، بدون أي تغيير بوضع النظام المدفوع

const API = window.location.origin + '/api';

(async function checkAboutAdsMode() {
    try {
        const res  = await fetch(`${API}/settings/active-system`);
        const data = await res.json();
        if (data.activeSystem === 'ads') switchAboutToAdsMode();
    } catch (e) {}
})();

function switchAboutToAdsMode() {
    // الهيدر
    document.getElementById('aboutHeroDesc').textContent = 'منصة إعلانات متخصصة في خدمات ومعدات البناء';

    // المهمة والرؤية
    document.getElementById('missionText').textContent = 'نوفر سوقاً إلكترونياً متخصصاً في خدمات البناء يربط أصحاب المشاريع بمزودي الخدمات مباشرة، بدون وسيط وبدون عمولة، قائماً على مبدأ الأمانة والمعاهدة الشرعية';
    document.getElementById('visionText').textContent  = 'أن نكون السوق الإلكتروني الأول والأكبر لخدمات البناء في المملكة العربية السعودية، بمنظومة قائمة على الثقة والشفافية';

    // القيم الأربعة
    const values = [
        { icon: 'handshake', title: 'الأمانة',           desc: 'منصتنا قائمة على معاهدة شرعية تلزم المعلن بدفع رسوم المنصة البسيطة عند تنفيذ الخدمة' },
        { icon: 'cash',      title: 'المجانية',           desc: 'انشر إعلانك مجاناً بدون رسوم مسبقة — تُدفع رسوم بسيطة 1% فقط بعد تنفيذ الخدمة' },
        { icon: 'chat',      title: 'التواصل المباشر',    desc: 'تواصل مباشرة مع المعلن عبر واتساب أو مكالمة بدون أي وسيط' },
        { icon: 'search',    title: 'الشفافية',           desc: 'أسعار واضحة ومعلنة للجميع — ما تخفى تكاليف أو رسوم مفاجئة' },
    ];
    values.forEach((v, i) => {
        const n = i + 1;
        document.getElementById(`value${n}Icon`).setAttribute('href', `icons.svg#icon-${v.icon}`);
        document.getElementById(`value${n}Title`).textContent = v.title;
        document.getElementById(`value${n}Desc`).textContent  = v.desc;
    });

    // لماذا غوث
    const whyCards = [
        { icon: 'flag',      title: 'سعودي 100%',         desc: 'منصة سعودية تفهم احتياجات السوق المحلي' },
        { icon: 'clipboard', title: 'قائم على المعاهدة',   desc: 'نظام فريد قائم على الالتزام الشرعي والأمانة' },
        { icon: 'cash',      title: 'بدون عمولة مسبقة',    desc: '1% فقط بعد تنفيذ الخدمة — لا شيء قبلها' },
    ];
    whyCards.forEach((w, i) => {
        const n = i + 1;
        document.getElementById(`why${n}Icon`).setAttribute('href', `icons.svg#icon-${w.icon}`);
        document.getElementById(`why${n}Title`).textContent = w.title;
        document.getElementById(`why${n}Desc`).textContent  = w.desc;
    });

    // CTA
    document.getElementById('ctaDesc').textContent = 'انضم لمنصة غوث وانشر إعلانك اليوم';

    const btn1 = document.getElementById('ctaBtn1');
    btn1.innerHTML = 'انشر إعلانك الآن <svg class="icon"><use href="icons.svg#icon-broadcast"></use></svg>';
    btn1.onclick = goToPublishAd;

    const btn2 = document.getElementById('ctaBtn2');
    btn2.innerHTML = 'تصفح الإعلانات <svg class="icon"><use href="icons.svg#icon-search"></use></svg>';
    btn2.onclick = () => window.location.href = 'ads.html';

    loadAdsStats();
}

// زر "انشر إعلانك الآن" — مسجّل دخوله يوديه لـ"إعلاناتي" مباشرة (ماكو تسجيل مزوّد منفصل بوضع الإعلانات)، غير مسجّل لتسجيل الدخول
function goToPublishAd() {
    const phone = localStorage.getItem('yashjub_phone');
    window.location.href = phone ? 'provider.html#adsSection' : 'login.html';
}

// إحصائيات حقيقية من بيانات الإعلانات/المستخدمين الفعلية — بدون endpoints تجميعية منفصلة، نفس أسلوب الحساب client-side المعتمد أصلاً بلوحة الإدارة
async function loadAdsStats() {
    try {
        const [adsRes, usersRes] = await Promise.all([
            fetch(`${API}/ads`),
            fetch(`${API}/users`),
        ]);
        const adsData   = await adsRes.json();
        const usersData = await usersRes.json();

        if (adsData.success) {
            const ads = adsData.ads;

            document.getElementById('statBox1Num').textContent   = ads.length;
            document.getElementById('statBox1Label').textContent = 'إعلان نشط';

            const cities = new Set(ads.map(a => a.city).filter(Boolean));
            document.getElementById('statBox3Num').textContent   = cities.size;
            document.getElementById('statBox3Label').textContent = 'مدينة';

            const rated = ads.filter(a => a.avg_rating);
            const avgRating = rated.length
                ? Math.round((rated.reduce((sum, a) => sum + a.avg_rating, 0) / rated.length) * 10) / 10
                : 0;
            document.getElementById('statBox4Num').innerHTML = `${avgRating} <svg class="icon"><use href="icons.svg#icon-star"></use></svg>`;
            document.getElementById('statBox4Label').textContent = 'تقييم';
        }

        if (usersData.success) {
            document.getElementById('statBox2Num').textContent   = usersData.users.length;
            document.getElementById('statBox2Label').textContent = 'مستخدم';
        }
    } catch (e) {}
}
