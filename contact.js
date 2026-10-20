// كود صفحة "تواصل معنا" — محتوى مختلف بوضع الإعلانات (منصة غوث معاهدة)، بدون أي تغيير بوضع النظام المدفوع

const API = window.location.origin + '/api';

(async function checkContactAdsMode() {
    try {
        const res  = await fetch(`${API}/settings/active-system`);
        const data = await res.json();
        if (data.activeSystem === 'ads') switchContactToAdsMode();
    } catch (e) {}
})();

function switchContactToAdsMode() {
    // الهيرو
    document.getElementById('contactHeroDesc').textContent = 'نحن هنا لمساعدتك في أي استفسار عن منصة غوث معاهدة';

    // رابط "انضم كمزود" بالفوتر — ماكو تسجيل مزوّد منفصل بوضع الإعلانات
    const footerJoinLink = document.getElementById('footerJoinProviderLink');
    if (footerJoinLink) footerJoinLink.style.display = 'none';

    // موضوع الرسالة
    document.getElementById('contactSubject').innerHTML = `
        <option value="">اختر الموضوع</option>
        <option value="ads-inquiry">استفسار عن الإعلانات</option>
        <option value="publish-issue">مشكلة في نشر إعلان</option>
        <option value="report-ad">الإبلاغ عن إعلان مخالف</option>
        <option value="fees-inquiry">استفسار عن رسوم المعاهدة</option>
        <option value="complaint">شكوى</option>
        <option value="suggestion">اقتراح</option>
        <option value="other">أخرى</option>
    `;

    // الأسئلة الشائعة
    const faqs = [
        {
            q: 'كيف أنشر إعلاناً؟',
            a: 'سجّل دخولك، اضغط على انشر إعلانك، اختر القسم المناسب (سطحة/حاوية/معدات ثقيلة)، أضف تفاصيل خدمتك وصورها، اقرأ معاهدة غوث ووافق عليها، ثم انشر!',
        },
        {
            q: 'ما هي رسوم النشر؟',
            a: 'النشر مجاني تماماً! الرسوم الوحيدة هي 1% من قيمة الخدمة بعد تنفيذها، وذلك بموجب معاهدة غوث التي توقّع عليها المعلن عند النشر',
        },
        {
            q: 'كيف يتواصل معي العميل؟',
            a: 'يتواصل معك العميل مباشرة عبر زر الاتصال أو واتساب الموجود في إعلانك، أو عبر نظام الرسائل الداخلي في المنصة',
        },
        {
            q: 'كم إعلاناً يمكنني نشره؟',
            a: 'يمكنك نشر إعلان واحد في كل قسم — إعلان في السطحة وآخر في الحاوية وثالث في المعدات الثقيلة',
        },
        {
            q: 'ما هي معاهدة غوث؟',
            a: 'معاهدة غوث هي تعهد شرعي يوقّعه المعلن عند نشر إعلانه، يلتزم فيه بدفع 1% من قيمة كل خدمة ينفذها عبر المنصة خلال 10 أيام من استلام المبلغ',
        },
    ];

    faqs.forEach((f, i) => {
        const n = i + 1;
        document.getElementById(`faq${n}Q`).textContent = f.q;
        document.getElementById(`faq${n}A`).textContent = f.a;
    });
}
