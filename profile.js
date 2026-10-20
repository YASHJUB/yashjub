// كود الملف الشخصي

const API = window.location.origin + '/api';

// رابط "انضم كمزود" بالفوتر — ماكو تسجيل مزوّد منفصل بوضع الإعلانات
(async function hideFooterJoinLinkInAdsMode() {
    try {
        const res  = await fetch(`${API}/settings/active-system`);
        const data = await res.json();
        if (data.activeSystem !== 'ads') return;
        const link = document.getElementById('footerJoinProviderLink');
        if (link) link.style.display = 'none';
    } catch (e) {}
})();

function loadProfile() {
    const phone = localStorage.getItem('yashjub_phone');
    const type  = localStorage.getItem('yashjub_type') || 'client';
    const name  = localStorage.getItem('yashjub_name');

    if (!phone) {
        showAppAlert('⚠️ يجب تسجيل الدخول أولاً', () => window.location.href = 'login.html');
        return;
    }

    // تحديث المعلومات الأساسية
    document.getElementById('profilePhone').textContent = `+966${phone}`;
    document.getElementById('infoPhone').textContent    = `+966${phone}`;
    document.getElementById('infoDate').textContent     = new Date().toLocaleDateString('ar-SA');

    loadMyEmail(phone);
    renderAvatar(localStorage.getItem('yashjub_avatar'));
    loadMyAvatar(phone);

    if (type === 'provider') {
        document.getElementById('profileName').textContent  = name || 'مزود خدمة';
        document.getElementById('profileBadge').innerHTML = '<svg class="icon"><use href="icons.svg#icon-worker"></use></svg>';
        document.getElementById('profileBadge').style.background = 'rgba(245,197,24,0.2)';
        document.getElementById('profileBadge').style.color = '#92700A';
        document.getElementById('infoType').textContent    = 'مزود خدمة';
        document.getElementById('providerAction').style.display = 'flex';
    } else {
        document.getElementById('profileName').textContent  = name || 'عميل غَوْث';
        document.getElementById('profileBadge').innerHTML = '<svg class="icon"><use href="icons.svg#icon-user"></use></svg> عميل';
        document.getElementById('infoType').textContent    = 'عميل';
    }
}

// إظهار/إخفاء فورم تعديل الاسم
function toggleEditName() {
    const form = document.getElementById('editNameForm');
    const isHidden = form.style.display === 'none';

    form.style.display = isHidden ? 'flex' : 'none';

    if (isHidden) {
        document.getElementById('editNameInput').value = document.getElementById('profileName').textContent;
        document.getElementById('editNameInput').focus();
    }
}

// حفظ تعديل الاسم
async function saveEditedName() {
    const name  = document.getElementById('editNameInput').value.trim();
    const phone = localStorage.getItem('yashjub_phone');

    if (!name) {
        alert('❌ يرجى إدخال اسم صحيح');
        return;
    }

    try {
        const response = await fetch(`${API}/users/${phone}/name`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ name })
        });

        const data = await response.json();

        if (data.success) {
            localStorage.setItem('yashjub_name', data.name);
            document.getElementById('profileName').textContent = data.name;
            document.getElementById('editNameForm').style.display = 'none';
        } else {
            alert(`❌ ${data.message}`);
        }

    } catch (error) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

function logoutProfile() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        localStorage.removeItem('yashjub_phone');
        localStorage.removeItem('yashjub_type');
        localStorage.removeItem('yashjub_name');
        localStorage.removeItem('yashjub_avatar');
        window.location.href = 'index.html';
    }
}

// ══ تغيير البريد الإلكتروني ══

async function loadMyEmail(phone) {
    try {
        const res  = await fetch(`${API}/users`);
        const data = await res.json();
        if (!data.success) return;

        const me = data.users.find(u => u.phone === phone);
        if (me && me.email) {
            document.getElementById('infoEmail').textContent = me.email;
        }
    } catch (e) {}
}

// ══ الصورة الشخصية (أفاتار) — موحّدة بين العميل والمزوّد، JPG أو PDF فقط ≤5MB ══

async function loadMyAvatar(phone) {
    try {
        const res  = await fetch(`${API}/users`);
        const data = await res.json();
        if (!data.success) return;

        const me = data.users.find(u => u.phone === phone);
        if (me && me.avatar_path) {
            localStorage.setItem('yashjub_avatar', me.avatar_path);
            renderAvatar(me.avatar_path);
        }
    } catch (e) {}
}

function renderAvatar(avatarPath) {
    const el = document.getElementById('profileAvatar');
    el.innerHTML = avatarPath
        ? `<img src="${avatarPath}" class="avatar-img" alt="صورتي">`
        : '<svg class="icon"><use href="icons.svg#icon-user"></use></svg>';
}

async function uploadAvatar(event) {
    const file  = event.target.files[0];
    const phone = localStorage.getItem('yashjub_phone');
    if (!file || !phone) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
        const res  = await fetch(`${API}/users/${phone}/avatar`, { method: 'PUT', body: formData });
        const data = await res.json();

        if (data.success) {
            localStorage.setItem('yashjub_avatar', data.avatarPath);
            renderAvatar(data.avatarPath);
            showAppAlert('✅ تم تحديث صورتك الشخصية');
        } else {
            showAppAlert(`❌ ${data.message}`);
        }
    } catch (e) {
        showAppAlert('❌ تعذّر رفع الصورة');
    }

    event.target.value = '';
}

// فتح/إغلاق قائمة "تغيير/حذف الصورة الشخصية"
function toggleAvatarMenu(event) {
    event.stopPropagation();
    const menu = document.getElementById('avatarMenu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', (e) => {
    const menu = document.getElementById('avatarMenu');
    const btn  = document.querySelector('.avatar-edit-btn');
    if (menu && menu.style.display !== 'none' && !menu.contains(e.target) && e.target !== btn) {
        menu.style.display = 'none';
    }
});

function chooseNewAvatar() {
    document.getElementById('avatarMenu').style.display = 'none';
    document.getElementById('avatarInput').click();
}

async function deleteAvatar() {
    document.getElementById('avatarMenu').style.display = 'none';
    const phone = localStorage.getItem('yashjub_phone');
    if (!phone) return;

    try {
        const res  = await fetch(`${API}/users/${phone}/avatar`, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
            localStorage.removeItem('yashjub_avatar');
            renderAvatar(null);
            showAppAlert('✅ تم حذف الصورة الشخصية');
        } else {
            showAppAlert(`❌ ${data.message}`);
        }
    } catch (e) {
        showAppAlert('❌ تعذّر حذف الصورة');
    }
}

function toggleEmailForm() {
    const form = document.getElementById('emailForm');
    const isHidden = form.style.display === 'none';
    form.style.display = isHidden ? 'flex' : 'none';

    if (isHidden) {
        const current = document.getElementById('infoEmail').textContent;
        document.getElementById('emailInput').value = current === 'غير محدد' ? '' : current;
        document.getElementById('emailInput').focus();
    }
}

async function saveEmail() {
    const email = document.getElementById('emailInput').value.trim();
    const phone = localStorage.getItem('yashjub_phone');

    if (!email) {
        alert('❌ يرجى إدخال بريد إلكتروني صحيح');
        return;
    }

    try {
        const res  = await fetch(`${API}/users/${phone}/email`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email })
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('infoEmail').textContent = data.email;
            document.getElementById('emailForm').style.display = 'none';
            showAppAlert('✅ تم تحديث البريد الإلكتروني');
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// ══ تغيير رقم الجوال (يتطلب التحقق من OTP للرقم الجديد) ══

let pendingNewPhone = null;

function togglePhoneForm() {
    const form = document.getElementById('phoneForm');
    const isHidden = form.style.display === 'none';
    form.style.display = isHidden ? 'flex' : 'none';
    document.getElementById('phoneOtpForm').style.display = 'none';
    pendingNewPhone = null;

    if (isHidden) {
        document.getElementById('newPhoneInput').value = '';
        document.getElementById('newPhoneInput').focus();
    }
}

async function sendChangePhoneOtp() {
    const newPhone = document.getElementById('newPhoneInput').value.trim();
    const currentPhone = localStorage.getItem('yashjub_phone');

    if (newPhone.length !== 9) {
        alert('❌ رقم الجوال يجب أن يكون 9 أرقام');
        return;
    }

    if (newPhone === currentPhone) {
        alert('❌ هذا هو رقمك الحالي');
        return;
    }

    try {
        const res  = await fetch(`${API}/auth/send-otp`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ phone: newPhone })
        });
        const data = await res.json();

        if (data.success) {
            pendingNewPhone = newPhone;
            alert(`📱 تم إرسال رمز التحقق:\n\n${data.otp}\n\n(في النسخة الحقيقية يُرسل عبر SMS)`);
            document.getElementById('phoneOtpForm').style.display = 'flex';
            document.getElementById('changePhoneOtpInput').value = '';
            document.getElementById('changePhoneOtpInput').focus();
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function confirmChangePhone() {
    const otp = document.getElementById('changePhoneOtpInput').value.trim();
    const currentPhone = localStorage.getItem('yashjub_phone');

    if (!otp || !pendingNewPhone) {
        alert('❌ يرجى إدخال رمز التحقق');
        return;
    }

    try {
        const res  = await fetch(`${API}/users/${currentPhone}/change-phone`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ newPhone: pendingNewPhone, otp })
        });
        const data = await res.json();

        if (data.success) {
            localStorage.setItem('yashjub_phone', data.phone);
            document.getElementById('profilePhone').textContent = `+966${data.phone}`;
            document.getElementById('infoPhone').textContent    = `+966${data.phone}`;
            document.getElementById('phoneForm').style.display    = 'none';
            document.getElementById('phoneOtpForm').style.display = 'none';
            pendingNewPhone = null;
            showAppAlert('✅ تم تحديث رقم جوالك بنجاح');
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// ══ حذف الحساب نهائياً ══

function openDeleteAccountModal() {
    document.getElementById('deleteAccountOverlay').style.display = 'flex';
}

function closeDeleteAccountModal() {
    document.getElementById('deleteAccountOverlay').style.display = 'none';
}

async function confirmDeleteAccount() {
    const phone = localStorage.getItem('yashjub_phone');

    try {
        const res  = await fetch(`${API}/users/${phone}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
            localStorage.removeItem('yashjub_phone');
            localStorage.removeItem('yashjub_type');
            localStorage.removeItem('yashjub_name');
            localStorage.removeItem('yashjub_avatar');
            showAppAlert('✅ تم حذف حسابك نهائياً', () => window.location.href = 'index.html');
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    } finally {
        closeDeleteAccountModal();
    }
}

// ══ الوضع الليلي ══

function toggleTheme() {
    const body = document.body;
    const btn  = document.getElementById('themeBtn');
    const isDark = body.classList.toggle('dark-mode');

    btn.innerHTML = isDark
        ? '<svg class="icon"><use href="icons.svg#icon-sun"></use></svg>'
        : '<svg class="icon"><use href="icons.svg#icon-moon"></use></svg>';
    localStorage.setItem('yashjub_theme', isDark ? 'dark' : 'light');
}

function loadTheme() {
    const theme = localStorage.getItem('yashjub_theme');
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        const btn = document.getElementById('themeBtn');
        if (btn) btn.innerHTML = '<svg class="icon"><use href="icons.svg#icon-sun"></use></svg>';
    }
}

loadProfile();
loadTheme();