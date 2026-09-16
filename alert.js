// نافذة تنبيه موحّدة بتصميم المنصة — بديل alert() الافتراضي بالمتصفح
// ملف مشترك بكل صفحات الموقع (نفس فلسفة icons.svg/style.css) لأنه أداة عرض واحدة مطابقة بالضبط بكل مكان

const APP_ALERT_TYPES = [
    { prefix: '✅', icon: 'check',     class: 'success' },
    { prefix: '🎉', icon: 'confetti',  class: 'success' },
    { prefix: '❌', icon: 'x-circle',  class: 'error'   },
    { prefix: '🚫', icon: 'x-circle',  class: 'error'   },
    { prefix: '⚠️', icon: 'warning',   class: 'warning' },
    { prefix: '📱', icon: 'phone',     class: 'info'    },
    { prefix: '💳', icon: 'card',      class: 'info'    },
];

function detectAppAlertType(message) {
    const found = APP_ALERT_TYPES.find(t => message.startsWith(t.prefix));
    return found || { icon: 'bell', class: 'info' };
}

// يعرض نافذة التنبيه، ويستدعي onClose (لو انبعث) بعد إغلاقها — يستخدم لأي منطق لازم يصير بعد ما يشوف المستخدم الرسالة
function showAppAlert(message, onClose) {
    const meta = detectAppAlertType(message);

    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.style.zIndex = '9999';
    overlay.innerHTML = `
        <div class="confirm-modal">
            <div class="app-alert-icon ${meta.class}"><svg class="icon"><use href="icons.svg#icon-${meta.icon}"></use></svg></div>
            <div class="app-alert-message"></div>
            <button class="app-alert-btn">حسناً</button>
        </div>
    `;

    overlay.querySelector('.app-alert-message').textContent = message;
    document.body.appendChild(overlay);

    const close = () => {
        overlay.remove();
        if (onClose) onClose();
    };

    overlay.querySelector('.app-alert-btn').onclick = close;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}

// استبدال alert() الافتراضي بكل الموقع — أي استدعاء alert('...') موجود أصلاً بأي ملف يشتغل تلقائياً بالتصميم الجديد بدون أي تعديل
window.alert = function (message) {
    showAppAlert(String(message));
};
