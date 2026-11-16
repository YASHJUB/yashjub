// كود لوحة الإدارة المتطورة

const API      = window.location.origin + '/api';
const ADMIN_PASS = 'yashjub2025';

// صلاحيات كل منصب — الصفحات المسموح للمنصب رؤيتها (admin يشوف كل شيء بدون قيود)
// أُعيد ربطها بصفحات نظام الإعلانات (الوحيد المتبقي بالمنصة) بعد إزالة النظام المدفوع بالكامل —
// أقرب تعويض منطقي لنفس طبيعة كل منصب: مشرف (محتوى+أعضاء)، دعم (بلاغات)، مراجع توثيق (الأعضاء)، محاسب (الصفحات المالية)
const ROLE_PAGES = {
    supervisor: ['ads', 'membersAds'],
    support:    ['complaints'],
    reviewer:   ['membersAds'],
    accountant: ['coinsAdmin', 'feesAdmin', 'financialReportsAds'],
};

const ROLE_LABELS = {
    admin:      { label: 'مدير عام',    class: 'badge-gold'    },
    supervisor: { label: 'مشرف',        class: 'badge-active'  },
    support:    { label: 'دعم فني',     class: 'badge-done'    },
    reviewer:   { label: 'مراجع توثيق', class: 'badge-purple'  },
    accountant: { label: 'محاسب',       class: 'badge-pending' },
};

let notificationsRefreshInterval = null;
let allNotifications             = [];
let currentNotifFilter           = 'all';
let cachedClientPhones           = new Set();
let cachedProviderPhones         = new Set();

let complaintsRefreshInterval = null;
let allComplaints             = [];
let currentComplaintFilter    = 'all';
let currentComplaintId        = null;

let reviewsRefreshInterval = null;
let allReviews             = [];
let currentReviewFilter    = 'all';
let currentReviewId        = null;

let testimonialsRefreshInterval = null;
let allTestimonials             = [];
let currentTestimonialFilter    = 'all';

// تسجيل الدخول
async function doLogin() {
    const user = document.getElementById('adminUser').value;
    const pass = document.getElementById('adminPass').value;

    if ((user === 'admin' || user === 'غوث') && pass === ADMIN_PASS) {
        enterAdminPanel('admin', 'المدير العام');
        return;
    }

    try {
        const res  = await fetch(`${API}/employees/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass }),
        });
        const data = await res.json();

        if (data.success) {
            enterAdminPanel(data.employee.role, data.employee.name);
        } else {
            alert('❌ بيانات الدخول غير صحيحة');
        }
    } catch (e) {
        alert('❌ بيانات الدخول غير صحيحة');
    }
}

// فتح اللوحة بعد نجاح الدخول (مدير عام أو موظف)
function enterAdminPanel(role, name) {
    sessionStorage.setItem('yashjub_admin', 'true');
    sessionStorage.setItem('yashjub_admin_role', role);
    sessionStorage.setItem('yashjub_admin_name', name);

    document.getElementById('loginScreen').style.display  = 'none';
    document.getElementById('adminLayout').style.display  = 'flex';

    applyRolePermissions(role, name);
    refreshSidebarBadges();

    const firstPage = role === 'admin' ? 'adsDashboard' : (ROLE_PAGES[role] || [])[0];
    if (firstPage) showPage(firstPage);
}

// تحديث بادجات السايد بار (إشعارات/شكاوى/تقييمات/شهادات) أول ما تُفتح اللوحة — بدون انتظار زيارة كل صفحة على حدة
function refreshSidebarBadges() {
    fetchNotificationsData();
    fetchComplaintsData();
    fetchReviewsData();
    fetchTestimonialsData();
}

// إظهار/إخفاء عناصر السايد بار حسب صلاحية المنصب
function applyRolePermissions(role, name) {
    document.getElementById('topbarAdminName').textContent   = name || 'المدير العام';
    document.getElementById('topbarAdminAvatar').textContent = (name || 'م').trim().charAt(0);

    const employeesNav = document.getElementById('navEmployees');
    const employeesLabel = document.getElementById('employeesSectionLabel');

    if (role === 'admin') {
        document.querySelectorAll('.sidebar-item[data-page]').forEach(i => i.style.display = 'flex');
        document.querySelectorAll('.sidebar-section-label').forEach(l => l.style.display = 'block');
        return;
    }

    if (employeesNav)   employeesNav.style.display   = 'none';
    if (employeesLabel) employeesLabel.style.display = 'none';

    const allowed = ROLE_PAGES[role] || [];
    document.querySelectorAll('.sidebar-item[data-page]').forEach(item => {
        const page = item.getAttribute('data-page');
        item.style.display = allowed.includes(page) ? 'flex' : 'none';
    });

    document.querySelectorAll('.sidebar-section-label').forEach(label => {
        let next = label.nextElementSibling;
        let hasVisible = false;
        while (next && next.classList.contains('sidebar-item')) {
            if (next.style.display !== 'none') hasVisible = true;
            next = next.nextElementSibling;
        }
        label.style.display = hasVisible ? 'block' : 'none';
    });
}

// تسجيل الخروج
function doLogout() {
    sessionStorage.removeItem('yashjub_admin');
    sessionStorage.removeItem('yashjub_admin_role');
    sessionStorage.removeItem('yashjub_admin_name');
    document.getElementById('loginScreen').style.display  = 'flex';
    document.getElementById('adminLayout').style.display  = 'none';
}

// التنقل بين الصفحات
function showPage(page) {
    document.querySelectorAll('[id^="page-"]').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    document.getElementById(`page-${page}`).style.display = 'block';

    const navEl = document.querySelector(`.sidebar-item[data-page="${page}"]`);
    if (navEl) navEl.classList.add('active');

    // إيقاف التحديث التلقائي لصفحة الإشعارات عند مغادرتها
    if (page !== 'notifications' && notificationsRefreshInterval) {
        clearInterval(notificationsRefreshInterval);
        notificationsRefreshInterval = null;
    }

    // إيقاف التحديث التلقائي لصفحة الشكاوى + إغلاق أي panel مفتوح عند مغادرتها
    if (page !== 'complaints') {
        if (complaintsRefreshInterval) {
            clearInterval(complaintsRefreshInterval);
            complaintsRefreshInterval = null;
        }
        closeComplaintPanel();
    }

    // إيقاف التحديث التلقائي لصفحة التقييمات + إغلاق أي panel مفتوح عند مغادرتها
    if (page !== 'reviews') {
        if (reviewsRefreshInterval) {
            clearInterval(reviewsRefreshInterval);
            reviewsRefreshInterval = null;
        }
        closeReviewPanel();
    }

    // إيقاف التحديث التلقائي لصفحة الشهادات عند مغادرتها
    if (page !== 'testimonials' && testimonialsRefreshInterval) {
        clearInterval(testimonialsRefreshInterval);
        testimonialsRefreshInterval = null;
    }

    if (page === 'employees')     loadEmployeesPage();
    if (page === 'cities')        loadCitiesPage();
    if (page === 'notifications') loadNotificationsPage();
    if (page === 'complaints')    loadComplaintsPage();
    if (page === 'reviews')       loadReviewsPage();
    if (page === 'testimonials')  loadTestimonialsPage();
    if (page === 'system')        loadSystemPage();
    if (page === 'ads')           loadAdsAdminPage();
    if (page === 'adsDashboard')  loadAdsDashboardPage();
    if (page === 'membersAds')    loadMembersPage();
    if (page === 'commentsAdmin') loadCommentsAdminPage();
    if (page === 'coinsAdmin')    loadCoinsAdminPage();
    if (page === 'feesAdmin')     loadFeesAdminPage();
    if (page === 'financialReportsAds')   loadFinancialReportsPage();
    if (page === 'adCategoriesSettings')  loadAdCategoriesSettingsPage();
    if (page === 'coinsConfigSettings')   loadCoinsConfigPage();
    if (page === 'covenantSettings')      loadCovenantConfigPage();
    if (page === 'translationsSettings')  loadTranslationsSettingsPage();
    if (page === 'bannedWordsSettings')   loadBannedWordsPage();
}

// صفحة الموظفين
let editingEmployeeId = null;

async function loadEmployeesPage() {
    try {
        const res  = await fetch(`${API}/employees`);
        const data = await res.json();
        if (!data.success) return;

        document.getElementById('allEmployeesTable').innerHTML = data.employees.map(e => {
            const roleInfo = ROLE_LABELS[e.role] || { label: e.role, class: 'badge-active' };
            return `
                <tr>
                    <td>#${e.id}</td>
                    <td>${e.name}</td>
                    <td><span class="badge ${roleInfo.class}">${roleInfo.label}</span></td>
                    <td dir="ltr">${e.phone}</td>
                    <td dir="ltr">${e.username}</td>
                    <td>${e.is_active ? '<span class="badge badge-done">نشط</span>' : '<span class="badge badge-cancel">موقوف</span>'}</td>
                    <td>${new Date(e.created_at).toLocaleDateString('ar-SA')}</td>
                    <td>
                        <button class="btn-detail" onclick='openEditEmployee(${JSON.stringify(e)})'>تعديل</button>
                        <button class="btn-detail" style="color:var(--red);border-color:var(--red)" onclick="deleteEmployee(${e.id})">حذف</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {}
}

function toggleEmployeeForm() {
    const form   = document.getElementById('employeeForm');
    const isOpen = form.style.display === 'block';

    if (isOpen) {
        form.style.display = 'none';
    } else {
        resetEmployeeForm();
        form.style.display = 'block';
    }
}

function resetEmployeeForm() {
    editingEmployeeId = null;
    document.getElementById('employeeFormTitle').textContent = 'إضافة موظف جديد';
    document.getElementById('empName').value             = '';
    document.getElementById('empPhone').value            = '';
    document.getElementById('empIban').value              = '';
    document.getElementById('empRole').value              = 'supervisor';
    document.getElementById('empUsername').value          = '';
    document.getElementById('empPassword').value          = '';
    document.getElementById('empPasswordConfirm').value   = '';
    document.getElementById('empActive').checked          = true;
    document.getElementById('empFormNote').style.display  = 'none';
}

function openEditEmployee(emp) {
    editingEmployeeId = emp.id;
    document.getElementById('employeeFormTitle').textContent = 'تعديل بيانات الموظف';
    document.getElementById('empName').value             = emp.name;
    document.getElementById('empPhone').value            = emp.phone;
    document.getElementById('empIban').value              = emp.iban || '';
    document.getElementById('empRole').value              = emp.role;
    document.getElementById('empUsername').value          = emp.username;
    document.getElementById('empPassword').value          = '';
    document.getElementById('empPasswordConfirm').value   = '';
    document.getElementById('empActive').checked          = !!emp.is_active;
    document.getElementById('empFormNote').style.display  = 'block';

    const form = document.getElementById('employeeForm');
    form.style.display = 'block';
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function submitEmployee() {
    const name     = document.getElementById('empName').value.trim();
    const phone    = document.getElementById('empPhone').value.trim();
    const iban     = document.getElementById('empIban').value.trim();
    const role     = document.getElementById('empRole').value;
    const username = document.getElementById('empUsername').value.trim();
    const password = document.getElementById('empPassword').value;
    const confirmPass = document.getElementById('empPasswordConfirm').value;
    const isActive = document.getElementById('empActive').checked;

    if (!name || !phone || !username) {
        alert('❌ يرجى تعبئة جميع الحقول المطلوبة');
        return;
    }

    if (!editingEmployeeId && !password) {
        alert('❌ كلمة المرور مطلوبة');
        return;
    }

    if (password && password !== confirmPass) {
        alert('❌ كلمة المرور وتأكيدها غير متطابقين');
        return;
    }

    try {
        const url    = editingEmployeeId ? `${API}/employees/${editingEmployeeId}` : `${API}/employees`;
        const method = editingEmployeeId ? 'PUT' : 'POST';

        const res  = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, iban, role, username, password, isActive }),
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('employeeForm').style.display = 'none';
            loadEmployeesPage();
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function deleteEmployee(id) {
    if (!confirm('هل أنت متأكد من حذف هذا الموظف؟')) return;

    try {
        await fetch(`${API}/employees/${id}`, { method: 'DELETE' });
        loadEmployeesPage();
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// صفحة المدن
async function loadCitiesPage() {
    try {
        const res  = await fetch(`${API}/cities`);
        const data = await res.json();
        if (!data.success) return;

        document.getElementById('allCitiesTable').innerHTML = data.cities.map(c => `
            <tr>
                <td>#${c.id}</td>
                <td>${c.name}</td>
                <td>${c.is_active ? '<span class="badge badge-done">نشطة</span>' : '<span class="badge badge-cancel">موقوفة</span>'}</td>
                <td>${new Date(c.created_at).toLocaleDateString('ar-SA')}</td>
                <td>
                    <button class="btn-detail" onclick='openEditCity(${JSON.stringify(c)})'>تعديل</button>
                    <button class="btn-detail" style="color:var(--red);border-color:var(--red)" onclick="deleteCity(${c.id})">حذف</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {}
}

function toggleCityForm() {
    const form   = document.getElementById('cityForm');
    const isOpen = form.style.display === 'block';

    if (isOpen) {
        form.style.display = 'none';
    } else {
        editingCityId = null;
        document.getElementById('cityFormTitle').textContent = 'إضافة مدينة جديدة';
        document.getElementById('cityName').value    = '';
        document.getElementById('cityActive').checked = true;
        form.style.display = 'block';
    }
}

function openEditCity(city) {
    editingCityId = city.id;
    document.getElementById('cityFormTitle').textContent = 'تعديل المدينة';
    document.getElementById('cityName').value     = city.name;
    document.getElementById('cityActive').checked = !!city.is_active;

    const form = document.getElementById('cityForm');
    form.style.display = 'block';
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function submitCity() {
    const name     = document.getElementById('cityName').value.trim();
    const isActive = document.getElementById('cityActive').checked;

    if (!name) {
        alert('❌ اسم المدينة مطلوب');
        return;
    }

    try {
        const url    = editingCityId ? `${API}/cities/${editingCityId}` : `${API}/cities`;
        const method = editingCityId ? 'PUT' : 'POST';

        const res  = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, isActive }),
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('cityForm').style.display = 'none';
            loadCitiesPage();
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function deleteCity(id) {
    if (!confirm('هل أنت متأكد من حذف هذه المدينة؟')) return;

    try {
        await fetch(`${API}/cities/${id}`, { method: 'DELETE' });
        loadCitiesPage();
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// ══ الإشعارات ══

const NOTIF_TYPE_META = {
    urgent: { color: 'var(--red)',    bg: 'rgba(239,68,68,0.1)',   icon: 'siren',    label: 'عاجل' },
    alert:  { color: 'var(--orange)', bg: 'rgba(245,158,11,0.1)',  icon: 'warning',  label: 'تنبيه' },
    update: { color: 'var(--green)',  bg: 'rgba(16,185,129,0.1)',  icon: 'bell',     label: 'عام'  },
    offer:  { color: '#92700A',       bg: 'rgba(245,197,24,0.15)', icon: 'confetti', label: 'عرض'  },
};

async function loadNotificationsPage() {
    await loadRecipientPhonesCache();
    await fetchNotificationsData();
    renderNotificationsLog();
    updateNotifRecipientCount();

    if (!notificationsRefreshInterval) {
        notificationsRefreshInterval = setInterval(async () => {
            await fetchNotificationsData();
            renderNotificationsLog();
        }, 30000);
    }
}

// أرقام جوال العملاء/المزودين — تُستخدم لمعاينة عدد المستلمين ولفلترة سجل الإشعارات "للعملاء"/"للمزودين" (راجع فقرة الإشعارات بالتوثيق)
async function loadRecipientPhonesCache() {
    try {
        const [usersRes, providersRes] = await Promise.all([
            fetch(`${API}/users`),
            fetch(`${API}/providers`),
        ]);
        const usersData     = await usersRes.json();
        const providersData = await providersRes.json();
        if (usersData.success)     cachedClientPhones   = new Set(usersData.users.map(u => u.phone));
        if (providersData.success) cachedProviderPhones = new Set(providersData.providers.map(p => p.phone));
    } catch (e) {}
}

async function fetchNotificationsData() {
    try {
        const res  = await fetch(`${API}/notifications/admin/all`);
        const data = await res.json();
        if (data.success) allNotifications = data.notifications;
        updateNotificationsBadge();
    } catch (e) {}
}

async function fetchNotificationsBadge() {
    await fetchNotificationsData();
}

function updateNotificationsBadge() {
    const badge = document.getElementById('notificationsBadge');
    if (!badge) return;
    const count = allNotifications.filter(n => !n.is_read).length;
    badge.textContent   = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
}

// إظهار/إخفاء حقل الجوال حسب المستلم المختار + تحديث معاينة عدد المستلمين
function onNotifTargetChange() {
    const target = document.querySelector('input[name="notifTarget"]:checked').value;
    document.getElementById('notifTargetPhone').style.display = target === 'specific' ? 'block' : 'none';
    updateNotifRecipientCount();
}

function updateNotifRecipientCount() {
    const target = document.querySelector('input[name="notifTarget"]:checked')?.value || 'clients';
    const el = document.getElementById('notifRecipientCount');
    let count = 0;

    if (target === 'clients')   count = cachedClientPhones.size;
    if (target === 'providers') count = cachedProviderPhones.size;
    if (target === 'all')       count = new Set([...cachedClientPhones, ...cachedProviderPhones]).size;
    if (target === 'specific')  count = document.getElementById('notifTargetPhone').value.trim() ? 1 : 0;

    el.textContent = `عدد المستلمين المتوقع: ${count}`;
}

async function submitNotification() {
    const target      = document.querySelector('input[name="notifTarget"]:checked').value;
    const targetPhone = document.getElementById('notifTargetPhone').value.trim();
    const type        = document.getElementById('notifType').value;
    const title       = document.getElementById('notifTitle').value.trim();
    const message     = document.getElementById('notifMessage').value.trim();

    if (!title || !message) {
        alert('❌ يرجى تعبئة العنوان والرسالة');
        return;
    }

    if (target === 'specific' && !targetPhone) {
        alert('❌ يرجى إدخال رقم جوال المستلم');
        return;
    }

    try {
        const res  = await fetch(`${API}/notifications/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, message, type, target, targetPhone: target === 'specific' ? targetPhone : undefined }),
        });
        const data = await res.json();

        if (data.success) {
            alert(`✅ تم إرسال الإشعار إلى ${data.count} مستلم`);
            document.getElementById('notifTitle').value       = '';
            document.getElementById('notifMessage').value     = '';
            document.getElementById('notifTargetPhone').value = '';
            await fetchNotificationsData();
            renderNotificationsLog();
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// تجميع صفوف الإشعارات المتطابقة (نفس العنوان/الرسالة/النوع/وقت الإرسال) بحدث إرسال واحد
function groupNotifications(list) {
    const groups = {};
    list.forEach(n => {
        const key = `${n.title}|${n.message}|${n.type}|${n.created_at}`;
        if (!groups[key]) groups[key] = { title: n.title, message: n.message, type: n.type, created_at: n.created_at, rows: [] };
        groups[key].rows.push(n);
    });
    return Object.values(groups).sort((a, b) => b.rows[0].id - a.rows[0].id);
}

function setNotifFilter(filter, btn) {
    currentNotifFilter = filter;
    document.querySelectorAll('.notif-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderNotificationsLog();
}

function renderNotificationsLog() {
    const container = document.getElementById('notificationsLogList');

    let list = allNotifications;
    if (currentNotifFilter === 'unread') {
        list = list.filter(n => !n.is_read);
    } else if (currentNotifFilter === 'clients') {
        list = list.filter(n => cachedClientPhones.has(n.receiver_phone));
    } else if (currentNotifFilter === 'providers') {
        list = list.filter(n => cachedProviderPhones.has(n.receiver_phone));
    }

    const groups = groupNotifications(list);

    if (!groups.length) {
        container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:24px;font-size:13px">لا توجد إشعارات مطابقة</p>';
        return;
    }

    container.innerHTML = groups.map((g, i) => {
        const meta = NOTIF_TYPE_META[g.type] || NOTIF_TYPE_META.update;
        const unreadCount = g.rows.filter(r => !r.is_read).length;
        const recipientsLabel = g.rows.length === 1 ? `المستلم: +966${g.rows[0].receiver_phone}` : `${g.rows.length} مستلم`;
        const groupKey = `notifGroup${i}`;
        const ids = g.rows.map(r => r.id);

        return `
            <div class="notif-log-item">
                <div class="notif-log-top">
                    <div class="notif-type-icon" style="background:${meta.bg};color:${meta.color}">
                        <svg class="icon"><use href="icons.svg#icon-${meta.icon}"></use></svg>
                    </div>
                    <div style="flex:1">
                        <div class="notif-log-title">${g.title}</div>
                        <div class="notif-log-message">${g.message}</div>
                        <div class="notif-log-meta">
                            <span>${recipientsLabel}</span>
                            <span>${new Date(g.created_at.replace(' ', 'T') + 'Z').toLocaleString('ar-SA')}</span>
                            ${unreadCount > 0 ? `<span class="badge badge-cancel">${unreadCount} غير مقروء</span>` : '<span class="badge badge-done">مقروء بالكامل</span>'}
                        </div>
                    </div>
                    <div class="notif-log-actions">
                        <button class="btn-detail" onclick="toggleNotifDetails('${groupKey}')">عرض التفاصيل</button>
                        <button class="btn-detail" style="color:var(--red);border-color:var(--red)" onclick='deleteNotifGroup(${JSON.stringify(ids)})'>حذف</button>
                    </div>
                </div>
                <div class="notif-log-details" id="${groupKey}" style="display:none">
                    ${g.rows.map(r => `+966${r.receiver_phone} — ${r.is_read ? 'مقروء' : 'غير مقروء'}`).join('<br>')}
                </div>
            </div>
        `;
    }).join('');
}

function toggleNotifDetails(groupKey) {
    const el = document.getElementById(groupKey);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function deleteNotifGroup(ids) {
    if (!confirm('هل أنت متأكد من حذف هذا الإشعار؟')) return;

    try {
        await Promise.all(ids.map(id => fetch(`${API}/notifications/${id}`, { method: 'DELETE' })));
        await fetchNotificationsData();
        renderNotificationsLog();
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function markAllNotificationsRead() {
    const unreadIds = allNotifications.filter(n => !n.is_read).map(n => n.id);
    if (!unreadIds.length) return;

    try {
        await Promise.all(unreadIds.map(id => fetch(`${API}/notifications/${id}/read`, { method: 'PUT' })));
        await fetchNotificationsData();
        renderNotificationsLog();
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// ══ البلاغات والشكاوى ══

const COMPLAINT_STATUS_LABELS = {
    new:       { label: 'جديدة',       class: 'complaint-status-new'       },
    reviewing: { label: 'قيد المراجعة', class: 'complaint-status-reviewing' },
    resolved:  { label: 'محلولة',      class: 'complaint-status-resolved'  },
    closed:    { label: 'مغلقة',       class: 'complaint-status-closed'    },
};

async function loadComplaintsPage() {
    await fetchComplaintsData();
    renderComplaintStats();
    renderComplaintsList();

    if (!complaintsRefreshInterval) {
        complaintsRefreshInterval = setInterval(async () => {
            await fetchComplaintsData();
            renderComplaintStats();
            renderComplaintsList();
        }, 30000);
    }
}

async function fetchComplaintsData() {
    try {
        const res  = await fetch(`${API}/complaints`);
        const data = await res.json();
        if (data.success) allComplaints = data.complaints;
        updateComplaintsBadge();
    } catch (e) {}
}

function updateComplaintsBadge() {
    const badge = document.getElementById('complaintBadge');
    if (!badge) return;
    const count = allComplaints.filter(c => c.status === 'new').length;
    badge.textContent   = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
}

function renderComplaintStats() {
    const now      = new Date();
    const monthStr = now.toISOString().slice(0, 7);

    const newCount          = allComplaints.filter(c => c.status === 'new').length;
    const reviewingCount    = allComplaints.filter(c => c.status === 'reviewing').length;
    const resolvedThisMonth = allComplaints.filter(c => c.status === 'resolved' && c.resolved_at && c.resolved_at.slice(0, 7) === monthStr).length;

    const resolvedWithTime = allComplaints.filter(c => c.resolved_at);
    let avgLabel = '—';
    if (resolvedWithTime.length) {
        const totalMinutes = resolvedWithTime.reduce((sum, c) => {
            const created  = new Date(c.created_at.replace(' ', 'T') + 'Z').getTime();
            const resolved = new Date(c.resolved_at.replace(' ', 'T') + 'Z').getTime();
            return sum + Math.max(0, (resolved - created) / 60000);
        }, 0);
        const avgMinutes = totalMinutes / resolvedWithTime.length;
        avgLabel = avgMinutes < 60 ? `${Math.round(avgMinutes)} د` : `${(avgMinutes / 60).toFixed(1)} س`;
    }

    document.getElementById('comp-new').textContent            = newCount;
    document.getElementById('comp-reviewing').textContent      = reviewingCount;
    document.getElementById('comp-resolved-month').textContent = resolvedThisMonth;
    document.getElementById('comp-avg-resolve').textContent    = avgLabel;
}

function setComplaintFilter(filter, btn) {
    currentComplaintFilter = filter;
    document.querySelectorAll('.complaint-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderComplaintsList();
}

function renderComplaintsList() {
    const container = document.getElementById('complaintsListContainer');
    const search = (document.getElementById('complaintSearchInput')?.value || '').trim().toLowerCase();

    let list = allComplaints;
    if (currentComplaintFilter === 'ads') {
        list = list.filter(c => c.ad_id);
    } else if (currentComplaintFilter !== 'all') {
        list = list.filter(c => c.status === currentComplaintFilter);
    }
    if (search) {
        list = list.filter(c =>
            String(c.id).includes(search) ||
            (c.order_id && String(c.order_id).includes(search)) ||
            (c.reporter_phone && c.reporter_phone.includes(search)) ||
            (c.reported_phone && c.reported_phone.includes(search))
        );
    }

    if (!list.length) {
        container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:24px;font-size:13px">لا توجد شكاوى مطابقة</p>';
        return;
    }

    container.innerHTML = list.map(c => {
        const status = COMPLAINT_STATUS_LABELS[c.status] || COMPLAINT_STATUS_LABELS.new;
        const reporterLabel = c.reporter_name || `+966${c.reporter_phone}`;
        const reportedLabel = c.reported_phone ? (c.reported_name || `+966${c.reported_phone}`) : '—';

        return `
            <div class="complaint-list-item status-${c.status}">
                <div>
                    <div class="complaint-list-top">
                        <span>شكوى #${c.id}${c.order_id ? ' — طلب #' + c.order_id : ''}${c.ad_id ? ' — 📢 ' + (c.ad_title || 'إعلان #' + c.ad_id) : ''}</span>
                        <span class="complaint-status-badge ${status.class}">${status.label}</span>
                        <span class="badge badge-active">${c.type}</span>
                    </div>
                    <div class="complaint-list-people">${reporterLabel} (${c.reporter_type === 'client' ? 'عميل' : 'مزوّد'}) ← بلاغ ضد: ${reportedLabel}</div>
                    <div class="complaint-list-desc">${c.description || 'بدون تفاصيل'}</div>
                    <div class="complaint-list-meta">${new Date(c.created_at.replace(' ', 'T') + 'Z').toLocaleString('ar-SA')}</div>
                </div>
                <div class="complaint-list-actions">
                    <button class="btn-detail" onclick="openComplaintPanel(${c.id})">عرض التفاصيل</button>
                </div>
            </div>
        `;
    }).join('');
}

async function openComplaintPanel(id) {
    currentComplaintId = id;

    try {
        const res  = await fetch(`${API}/complaints/${id}`);
        const data = await res.json();
        if (!data.success) return;

        const complaint = data.complaint;
        let order        = null;
        let chatMessages = [];

        if (complaint.order_id) {
            const [orderRes, chatRes] = await Promise.all([
                fetch(`${API}/orders/${complaint.order_id}`),
                fetch(`${API}/chats/${complaint.order_id}`),
            ]);
            const orderData = await orderRes.json();
            const chatData  = await chatRes.json();
            if (orderData.success) order = orderData.order;
            if (chatData.success)  chatMessages = chatData.messages;
        }

        document.getElementById('compPanelId').textContent  = id;
        document.getElementById('compPanelSub').textContent = `${complaint.type} — ${new Date(complaint.created_at.replace(' ', 'T') + 'Z').toLocaleString('ar-SA')}`;
        renderComplaintPanelBody(complaint, order, chatMessages);

        document.getElementById('complaintPanelOverlay').style.display = 'block';
    } catch (e) {}
}

function closeComplaintPanel() {
    const overlay = document.getElementById('complaintPanelOverlay');
    if (overlay) overlay.style.display = 'none';
    currentComplaintId = null;
}

function renderComplaintPanelBody(complaint, order, chatMessages) {
    const status         = COMPLAINT_STATUS_LABELS[complaint.status] || COMPLAINT_STATUS_LABELS.new;
    const reporterLabel   = complaint.reporter_name || `+966${complaint.reporter_phone}`;
    const reportedLabel   = complaint.reported_phone ? (complaint.reported_name || `+966${complaint.reported_phone}`) : 'غير محدد';

    const orderSection = order ? `
        <div class="complaint-section-title">تفاصيل الطلب المرتبط</div>
        <div class="complaint-info-row"><span>الخدمة</span><span>${order.service}</span></div>
        <div class="complaint-info-row"><span>العنوان</span><span>${order.address}</span></div>
        <div class="complaint-info-row"><span>السعر</span><span>${order.price} ريال</span></div>
        <div class="complaint-info-row"><span>حالة الطلب</span><span>${order.status}</span></div>
    ` : '';

    const adSection = complaint.ad_id ? `
        <div class="complaint-section-title">الإعلان المُبلَّغ عنه</div>
        <div class="complaint-info-row"><span>العنوان</span><span>${complaint.ad_title || `#${complaint.ad_id}`}</span></div>
        <div class="complaint-info-row"><span>القسم</span><span>${complaint.ad_category || '—'}</span></div>
        <div style="display:flex;gap:8px;margin:8px 0 4px">
            <button class="btn-detail" style="flex:1" onclick="window.open('ad-details.html?id=${complaint.ad_id}','_blank')">👁️ عرض الإعلان</button>
            <button class="btn-detail" style="flex:1;color:var(--red)" onclick="deleteReportedAd(${complaint.ad_id})">🗑️ حذف الإعلان</button>
        </div>
    ` : '';

    const chatSection = chatMessages.length ? `
        <div class="complaint-section-title">سجل المحادثة</div>
        <div class="complaint-chat-preview">
            ${chatMessages.map(m => `<div style="font-size:12px;margin-bottom:6px"><strong>${CHAT_SENDER_LABELS[m.sender] || m.sender}:</strong> ${m.message}</div>`).join('')}
        </div>
    ` : '';

    const actionLog = complaint.action_taken
        ? complaint.action_taken.split('\n').map(line => `<div class="complaint-log-entry">${line}</div>`).join('')
        : '<p style="font-size:12px;color:var(--text3)">لا يوجد إجراءات بعد</p>';

    const needsDuration = complaint.reported_type === 'provider' || complaint.reported_type === 'client';

    document.getElementById('complaintPanelBody').innerHTML = `
        <div class="complaint-section-title">معلومات الشكوى</div>
        <div class="complaint-info-row"><span>الحالة</span><span class="complaint-status-badge ${status.class}">${status.label}</span></div>
        <div class="complaint-info-row"><span>النوع</span><span>${complaint.type}</span></div>
        <div class="complaint-info-row"><span>المُبلِّغ</span><span>${reporterLabel} (${complaint.reporter_type === 'client' ? 'عميل' : 'مزوّد'})</span></div>
        <div class="complaint-info-row"><span>المُبلَّغ عنه</span><span>${reportedLabel}</span></div>
        <div style="font-size:13px;color:var(--text2);margin-top:8px;line-height:1.6">${complaint.description || 'بدون تفاصيل'}</div>

        ${orderSection}
        ${adSection}
        ${chatSection}

        <div class="complaint-section-title">تغيير الحالة</div>
        <select id="compStatusSelect" style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid var(--gray2);font-family:'Cairo',sans-serif;font-size:13px;margin-bottom:10px">
            <option value="new" ${complaint.status === 'new' ? 'selected' : ''}>جديدة</option>
            <option value="reviewing" ${complaint.status === 'reviewing' ? 'selected' : ''}>قيد المراجعة</option>
            <option value="resolved" ${complaint.status === 'resolved' ? 'selected' : ''}>محلولة</option>
            <option value="closed" ${complaint.status === 'closed' ? 'selected' : ''}>مغلقة</option>
        </select>
        <button class="btn-detail" style="width:100%;margin-bottom:16px" onclick="updateComplaintStatus()">حفظ الحالة</button>

        <div class="complaint-section-title">ملاحظة / رد (تُستخدم مع الإجراءات بالأسفل)</div>
        <textarea id="compActionNote" placeholder="اكتب ملاحظة للإجراء أو نص الرد هنا...">${complaint.admin_note || ''}</textarea>

        ${needsDuration ? `
        <select id="compSuspendDuration" style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--gray2);font-family:'Cairo',sans-serif;font-size:12px;margin-bottom:8px">
            <option value="day">إيقاف يوم واحد</option>
            <option value="week">إيقاف أسبوع</option>
            <option value="month">إيقاف شهر</option>
        </select>` : ''}

        <div class="complaint-section-title">الإجراءات</div>
        <div class="complaint-action-grid">
            <button class="complaint-action-btn" onclick="submitComplaintAction('resolve')"><svg class="icon"><use href="icons.svg#icon-check"></use></svg> تم الحل</button>
            <button class="complaint-action-btn" onclick="submitComplaintAction('refund')"><svg class="icon"><use href="icons.svg#icon-cash"></use></svg> استرداد المبلغ</button>
            <button class="complaint-action-btn" onclick="submitComplaintAction('warn')" ${!complaint.reported_phone ? 'disabled' : ''}><svg class="icon"><use href="icons.svg#icon-warning"></use></svg> إرسال تحذير</button>
            <button class="complaint-action-btn" onclick="submitComplaintAction('suspend')" ${!complaint.reported_phone ? 'disabled' : ''}><svg class="icon"><use href="icons.svg#icon-lock"></use></svg> إيقاف مؤقت</button>
            <button class="complaint-action-btn danger" onclick="submitComplaintAction('delete')" ${!complaint.reported_phone ? 'disabled' : ''}><svg class="icon"><use href="icons.svg#icon-trash"></use></svg> حذف الحساب</button>
            <button class="complaint-action-btn" onclick="submitComplaintAction('reply')"><svg class="icon"><use href="icons.svg#icon-chat"></use></svg> إرسال رد</button>
            <button class="complaint-action-btn" style="grid-column:1/-1" onclick="submitComplaintAction('close')"><svg class="icon"><use href="icons.svg#icon-x-circle"></use></svg> إغلاق بدون إجراء</button>
        </div>

        <div class="complaint-section-title">سجل الإجراءات</div>
        ${actionLog}
    `;
}

async function deleteReportedAd(adId) {
    if (!confirm('هل أنت متأكد من حذف هذا الإعلان نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.')) return;
    try {
        await fetch(`${API}/ads/${adId}`, { method: 'DELETE' });
        alert('✅ تم حذف الإعلان');
        closeComplaintPanel();
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function updateComplaintStatus() {
    const status    = document.getElementById('compStatusSelect').value;
    const adminNote = document.getElementById('compActionNote').value.trim();

    try {
        await fetch(`${API}/complaints/${currentComplaintId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, adminNote }),
        });
        await fetchComplaintsData();
        renderComplaintStats();
        renderComplaintsList();
        openComplaintPanel(currentComplaintId);
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function submitComplaintAction(actionType) {
    const note        = document.getElementById('compActionNote').value.trim();
    const durationEl   = document.getElementById('compSuspendDuration');
    const duration     = durationEl ? durationEl.value : null;

    if (actionType === 'reply' && !note) {
        alert('❌ يرجى كتابة نص الرد بحقل الملاحظة بالأعلى');
        return;
    }
    if (actionType === 'delete' && !confirm('هل أنت متأكد من حذف هذا الحساب نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.')) return;
    if (actionType === 'suspend' && !confirm('هل أنت متأكد من إيقاف هذا الحساب مؤقتاً؟')) return;

    try {
        const res  = await fetch(`${API}/complaints/${currentComplaintId}/action`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actionType, note, duration, replyMessage: note }),
        });
        const data = await res.json();

        if (data.success) {
            await fetchComplaintsData();
            renderComplaintStats();
            renderComplaintsList();
            openComplaintPanel(currentComplaintId);
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// ══ التقييمات ══

function getRatingClass(rating) {
    if (rating === 5) return 'rating-good';
    if (rating >= 3)  return 'rating-mid';
    return 'rating-bad';
}

function renderStarIcons(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        html += `<svg class="icon" style="opacity:${i <= rating ? 1 : 0.25}"><use href="icons.svg#icon-star"></use></svg>`;
    }
    return html;
}

async function loadReviewsPage() {
    await Promise.all([fetchReviewsData(), fetchReviewStats()]);
    renderReviewsList();

    if (!reviewsRefreshInterval) {
        reviewsRefreshInterval = setInterval(async () => {
            await Promise.all([fetchReviewsData(), fetchReviewStats()]);
            renderReviewsList();
        }, 30000);
    }
}

async function fetchReviewsData() {
    try {
        const res  = await fetch(`${API}/reviews`);
        const data = await res.json();
        if (data.success) allReviews = data.reviews;
        updateReviewsBadge();
    } catch (e) {}
}

function updateReviewsBadge() {
    const badge = document.getElementById('reviewsBadge');
    if (!badge) return;
    const count = allReviews.filter(r => r.is_flagged).length;
    badge.textContent   = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
}

async function fetchReviewStats() {
    try {
        const res  = await fetch(`${API}/reviews/stats`);
        const data = await res.json();
        if (!data.success) return;

        const s = data.stats;
        document.getElementById('rev-avg').textContent         = s.total ? s.avg : '—';
        document.getElementById('rev-total').textContent       = s.total;
        document.getElementById('rev-satisfied').textContent   = `${s.satisfiedPct}%`;
        document.getElementById('rev-unsatisfied').textContent = `${s.unsatisfiedPct}%`;

        document.getElementById('starDistribution').innerHTML = [5, 4, 3, 2, 1].map(star => {
            const d = s.distribution[star];
            return `
                <div class="star-dist-row">
                    <div class="star-dist-label">${star} <svg class="icon" style="color:var(--gold)"><use href="icons.svg#icon-star"></use></svg></div>
                    <div class="star-dist-track"><div class="star-dist-fill" style="width:${d.percent}%"></div></div>
                    <div class="star-dist-count">${d.count} (${d.percent}%)</div>
                </div>
            `;
        }).join('');

        document.getElementById('topProvidersList').innerHTML = s.topProviders.length
            ? s.topProviders.map((p, i) => `
                <div class="provider-rank-item">
                    <div class="provider-rank-num">${i + 1}</div>
                    <div class="provider-rank-name">${p.name || '+966' + p.phone}</div>
                    <div class="star-rating-display ${getRatingClass(Math.round(p.avg_rating))}"><svg class="icon"><use href="icons.svg#icon-star"></use></svg> ${p.avg_rating}</div>
                    <div class="provider-rank-count">(${p.review_count})</div>
                </div>
            `).join('')
            : '<p style="font-size:12px;color:var(--text3)">لا يوجد بيانات كافية</p>';

        document.getElementById('bottomProvidersList').innerHTML = s.bottomProviders.length
            ? s.bottomProviders.map((p, i) => `
                <div class="provider-rank-item">
                    <div class="provider-rank-num">${i + 1}</div>
                    <div class="provider-rank-name">${p.name || '+966' + p.phone}</div>
                    <div class="star-rating-display ${getRatingClass(Math.round(p.avg_rating))}"><svg class="icon"><use href="icons.svg#icon-star"></use></svg> ${p.avg_rating}</div>
                    <div class="provider-rank-count">(${p.review_count})</div>
                </div>
            `).join('')
            : '<p style="font-size:12px;color:var(--text3)">لا يوجد بيانات كافية</p>';
    } catch (e) {}
}

function setReviewFilter(filter, btn) {
    currentReviewFilter = filter;
    document.querySelectorAll('.review-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderReviewsList();
}

function renderReviewsList() {
    const container = document.getElementById('reviewsListContainer');
    const search = (document.getElementById('reviewSearchInput')?.value || '').trim().toLowerCase();

    let list = allReviews;
    if (currentReviewFilter === 'excellent') list = list.filter(r => r.rating === 5);
    else if (currentReviewFilter === 'good')  list = list.filter(r => r.rating === 3 || r.rating === 4);
    else if (currentReviewFilter === 'bad')   list = list.filter(r => r.rating <= 2);
    else if (currentReviewFilter === 'hidden')  list = list.filter(r => !r.is_visible);
    else if (currentReviewFilter === 'flagged') list = list.filter(r => r.is_flagged);

    if (search) {
        list = list.filter(r =>
            String(r.id).includes(search) ||
            (r.order_id && String(r.order_id).includes(search)) ||
            (r.reviewer_name && r.reviewer_name.toLowerCase().includes(search)) ||
            (r.reviewed_name && r.reviewed_name.toLowerCase().includes(search)) ||
            (r.reviewer_phone && r.reviewer_phone.includes(search)) ||
            (r.reviewed_phone && r.reviewed_phone.includes(search))
        );
    }

    if (!list.length) {
        container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:24px;font-size:13px">لا توجد تقييمات مطابقة</p>';
        return;
    }

    container.innerHTML = list.map(r => {
        const reviewerLabel = r.reviewer_name || `+966${r.reviewer_phone}`;
        const reviewedLabel = r.reviewed_name || `+966${r.reviewed_phone}`;

        const statusBadges = [];
        statusBadges.push(r.is_visible
            ? '<span class="review-status-badge review-status-visible">ظاهر</span>'
            : '<span class="review-status-badge review-status-hidden">مخفي</span>');
        if (r.is_flagged) statusBadges.push('<span class="review-status-badge review-status-flagged">مشبوه</span>');

        return `
            <div class="review-list-item ${getRatingClass(r.rating)}">
                <div>
                    <div class="review-list-top">
                        <span class="star-rating-display ${getRatingClass(r.rating)}">${renderStarIcons(r.rating)}</span>
                        ${statusBadges.join('')}
                        ${r.order_id ? `<span class="badge badge-active">${r.order_service || ''} #${r.order_id}</span>` : ''}
                    </div>
                    ${r.comment ? `<div class="review-list-comment">${r.comment}</div>` : ''}
                    <div class="review-list-people">${reviewerLabel} (${r.reviewer_type === 'client' ? 'عميل' : 'مزوّد'}) ← تقييم لـ: ${reviewedLabel}</div>
                    <div class="review-list-meta">${new Date(r.created_at.replace(' ', 'T') + 'Z').toLocaleString('ar-SA')}</div>
                </div>
                <div class="review-list-actions">
                    <button class="btn-detail" onclick="openReviewPanel(${r.id})">عرض التفاصيل</button>
                </div>
            </div>
        `;
    }).join('');
}

function openReviewPanel(id) {
    currentReviewId = id;
    const review = allReviews.find(r => r.id === id);
    if (!review) return;

    document.getElementById('revPanelId').textContent = id;
    renderReviewPanelBody(review);
    document.getElementById('reviewPanelOverlay').style.display = 'block';
}

function closeReviewPanel() {
    const overlay = document.getElementById('reviewPanelOverlay');
    if (overlay) overlay.style.display = 'none';
    currentReviewId = null;
}

function renderReviewPanelBody(review) {
    const reviewerLabel = review.reviewer_name || `+966${review.reviewer_phone}`;
    const reviewedLabel = review.reviewed_name || `+966${review.reviewed_phone}`;

    // تقييم عكسي لنفس الطلب (لو موجود) — مثلاً تقييم المزوّد للعميل بنفس الطلب
    const reverseReview = review.order_id
        ? allReviews.find(r => r.order_id === review.order_id && r.id !== review.id && r.reviewer_phone === review.reviewed_phone)
        : null;

    const reverseSection = reverseReview ? `
        <div class="complaint-section-title">تقييم ${review.reviewed_type === 'provider' ? 'المزوّد للعميل' : 'العميل للمزوّد'}</div>
        <div class="star-rating-display ${getRatingClass(reverseReview.rating)}">${renderStarIcons(reverseReview.rating)}</div>
        ${reverseReview.comment ? `<div style="font-size:13px;color:var(--text2);margin-top:6px">${reverseReview.comment}</div>` : ''}
    ` : '';

    document.getElementById('reviewPanelBody').innerHTML = `
        <div class="complaint-section-title">التقييم</div>
        <div class="star-rating-display ${getRatingClass(review.rating)}" style="font-size:18px;margin-bottom:10px">${renderStarIcons(review.rating)}</div>
        ${review.comment ? `<div style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:10px">${review.comment}</div>` : '<p style="font-size:12px;color:var(--text3)">بدون تعليق</p>'}

        <div class="complaint-info-row"><span>المُقيِّم</span><span>${reviewerLabel} (${review.reviewer_type === 'client' ? 'عميل' : 'مزوّد'})</span></div>
        <div class="complaint-info-row"><span>المُقيَّم</span><span>${reviewedLabel} (${review.reviewed_type === 'client' ? 'عميل' : 'مزوّد'})</span></div>
        ${review.order_id ? `<div class="complaint-info-row"><span>الطلب</span><span>${review.order_service || ''} #${review.order_id}</span></div>` : ''}
        <div class="complaint-info-row"><span>التاريخ</span><span>${new Date(review.created_at.replace(' ', 'T') + 'Z').toLocaleString('ar-SA')}</span></div>

        ${reverseSection}

        <div class="complaint-section-title">رد الإدارة</div>
        ${review.admin_reply ? `<div style="font-size:13px;background:var(--gray);border-radius:8px;padding:10px 12px;margin-bottom:10px">${review.admin_reply}</div>` : ''}
        <textarea id="reviewReplyInput" placeholder="اكتب رداً على هذا التقييم...">${review.admin_reply || ''}</textarea>
        <button class="btn-detail" style="width:100%;margin-top:8px;margin-bottom:16px" onclick="submitReviewReply()">إرسال الرد</button>

        <div class="complaint-section-title">الإجراءات</div>
        <div class="complaint-action-grid">
            <button class="complaint-action-btn" onclick="toggleReviewVisibility(true)"><svg class="icon"><use href="icons.svg#icon-check"></use></svg> موافق (إظهار)</button>
            <button class="complaint-action-btn" onclick="toggleReviewVisibility(false)"><svg class="icon"><use href="icons.svg#icon-ghost"></use></svg> إخفاء</button>
            <button class="complaint-action-btn danger" onclick="toggleReviewFlag(${!review.is_flagged})">
                <svg class="icon"><use href="icons.svg#icon-flag"></use></svg> ${review.is_flagged ? 'إلغاء الإشارة كمشبوه' : 'تحديد كمشبوه'}
            </button>
            <button class="complaint-action-btn danger" onclick="deleteReviewAction()"><svg class="icon"><use href="icons.svg#icon-trash"></use></svg> حذف</button>
        </div>
    `;
}

async function toggleReviewVisibility(isVisible) {
    try {
        const res  = await fetch(`${API}/reviews/${currentReviewId}/visibility`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isVisible }),
        });
        const data = await res.json();
        if (data.success) {
            await Promise.all([fetchReviewsData(), fetchReviewStats()]);
            renderReviewsList();
            openReviewPanel(currentReviewId);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function toggleReviewFlag(isFlagged) {
    try {
        const res  = await fetch(`${API}/reviews/${currentReviewId}/flag`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isFlagged }),
        });
        const data = await res.json();
        if (data.success) {
            await fetchReviewsData();
            renderReviewsList();
            openReviewPanel(currentReviewId);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function submitReviewReply() {
    const reply = document.getElementById('reviewReplyInput').value.trim();
    if (!reply) {
        alert('❌ يرجى كتابة نص الرد');
        return;
    }

    try {
        const res  = await fetch(`${API}/reviews/${currentReviewId}/reply`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reply }),
        });
        const data = await res.json();
        if (data.success) {
            await fetchReviewsData();
            renderReviewsList();
            openReviewPanel(currentReviewId);
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function deleteReviewAction() {
    if (!confirm('هل أنت متأكد من حذف هذا التقييم نهائياً؟')) return;

    try {
        await fetch(`${API}/reviews/${currentReviewId}`, { method: 'DELETE' });
        closeReviewPanel();
        await Promise.all([fetchReviewsData(), fetchReviewStats()]);
        renderReviewsList();
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// ══ شهادات العملاء ══

const TESTIMONIAL_STATUS_LABELS = {
    pending:  { label: 'معلقة',        cls: 'testimonial-status-pending'  },
    approved: { label: 'موافق عليها',  cls: 'testimonial-status-approved' },
    rejected: { label: 'مرفوضة',       cls: 'testimonial-status-rejected' },
    hidden:   { label: 'مخفية',        cls: 'testimonial-status-hidden'   },
};

async function loadTestimonialsPage() {
    await fetchTestimonialsData();
    renderTestimonialStats();
    renderTestimonialsList();

    if (!testimonialsRefreshInterval) {
        testimonialsRefreshInterval = setInterval(async () => {
            await fetchTestimonialsData();
            renderTestimonialStats();
            renderTestimonialsList();
        }, 30000);
    }
}

async function fetchTestimonialsData() {
    try {
        const res  = await fetch(`${API}/testimonials/all`);
        const data = await res.json();
        if (data.success) allTestimonials = data.testimonials;
        updateTestimonialsBadge();
    } catch (e) {}
}

function updateTestimonialsBadge() {
    const badge = document.getElementById('testimonialsBadge');
    if (!badge) return;
    const count = allTestimonials.filter(t => t.status === 'pending').length;
    badge.textContent   = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
}

function renderTestimonialStats() {
    const pendingEl  = document.getElementById('test-pending');
    if (!pendingEl) return;
    document.getElementById('test-pending').textContent  = allTestimonials.filter(t => t.status === 'pending').length;
    document.getElementById('test-approved').textContent = allTestimonials.filter(t => t.status === 'approved').length;
    document.getElementById('test-rejected').textContent = allTestimonials.filter(t => t.status === 'rejected').length;
    document.getElementById('test-hidden').textContent   = allTestimonials.filter(t => t.status === 'hidden').length;
}

function setTestimonialFilter(filter, btn) {
    currentTestimonialFilter = filter;
    document.querySelectorAll('.testimonial-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderTestimonialsList();
}

function renderTestimonialsList() {
    const container = document.getElementById('testimonialsListContainer');
    if (!container) return;

    let list = allTestimonials;
    if (currentTestimonialFilter !== 'all') list = list.filter(t => t.status === currentTestimonialFilter);

    if (!list.length) {
        container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:24px;font-size:13px">لا توجد شهادات مطابقة</p>';
        return;
    }

    container.innerHTML = list.map(t => {
        const statusInfo = TESTIMONIAL_STATUS_LABELS[t.status] || TESTIMONIAL_STATUS_LABELS.pending;

        return `
            <div class="testimonial-list-item status-${t.status}">
                <div>
                    <div class="testimonial-list-top">
                        <strong>${t.client_name}</strong>
                        <span style="color:var(--text3);font-size:12px">+966${t.client_phone}</span>
                        <span class="testimonial-status-badge ${statusInfo.cls}">${statusInfo.label}</span>
                        ${t.service ? `<span class="badge badge-active">${t.service}</span>` : ''}
                    </div>
                    <div class="star-rating-display ${getRatingClass(t.rating)}">${renderStarIcons(t.rating)}</div>
                    <div class="testimonial-list-comment">${t.comment}</div>
                    <div class="testimonial-list-meta">${new Date(t.created_at.replace(' ', 'T') + 'Z').toLocaleString('ar-SA')}</div>
                </div>
                <div class="testimonial-list-actions">
                    <button class="complaint-action-btn" onclick="setTestimonialStatus(${t.id}, 'approved')"><svg class="icon"><use href="icons.svg#icon-check"></use></svg> موافقة</button>
                    <button class="complaint-action-btn" onclick="setTestimonialStatus(${t.id}, 'hidden')"><svg class="icon"><use href="icons.svg#icon-ghost"></use></svg> إخفاء</button>
                    <button class="complaint-action-btn danger" onclick="setTestimonialStatus(${t.id}, 'rejected')"><svg class="icon"><use href="icons.svg#icon-x-circle"></use></svg> رفض</button>
                    <button class="complaint-action-btn danger" onclick="deleteTestimonialAction(${t.id})"><svg class="icon"><use href="icons.svg#icon-trash"></use></svg> حذف نهائي</button>
                </div>
            </div>
        `;
    }).join('');
}

async function setTestimonialStatus(id, status) {
    try {
        const res  = await fetch(`${API}/testimonials/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        const data = await res.json();
        if (data.success) {
            await fetchTestimonialsData();
            renderTestimonialStats();
            renderTestimonialsList();
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function deleteTestimonialAction(id) {
    if (!confirm('هل أنت متأكد من حذف هذه الشهادة نهائياً؟')) return;

    try {
        await fetch(`${API}/testimonials/${id}`, { method: 'DELETE' });
        await fetchTestimonialsData();
        renderTestimonialStats();
        renderTestimonialsList();
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}


// ══ النظام والسياسات (تفعيل/تعطيل أنظمة المنصة) ══

// النظام المدفوع أُزيل بالكامل من المنصة — نظام الإعلانات صار الوحيد، فالبطاقة هنا للعرض فقط (بدون toggle، ماكو نظام ثاني يُرجع إليه)
async function loadSystemPage() {
    document.getElementById('systemSettingsList').innerHTML = `
        <div class="system-card enabled">
            <div class="system-card-icon"><svg class="icon"><use href="icons.svg#icon-broadcast"></use></svg></div>
            <div class="system-card-body">
                <div class="system-card-name">منصة عتاد معاهدة - إعلانات</div>
                <div class="system-card-desc">نظام الإعلانات المجاني — المزود ينشر إعلانه والعميل يتواصل معه مباشرة عبر واتساب أو مكالمة. هذا هو نظام المنصة الوحيد حالياً.</div>
                <span class="badge badge-done">مفعّل ✅</span>
            </div>
        </div>
    `;
}

// ══ إدارة الإعلانات (منصة عتاد معاهدة) ══

let allAds = [];

async function loadAdsAdminPage() {
    try {
        const res  = await fetch(`${API}/ads?includeInactive=1`);
        const data = await res.json();
        if (!data.success) return;

        allAds = data.ads;

        // إحصائيات
        const activeCount = allAds.filter(a => a.is_active).length;
        document.getElementById('adsActiveCount').textContent = activeCount;

        const categoryCounts = {};
        const cityCounts     = {};
        allAds.forEach(a => {
            categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
            cityCounts[a.city]         = (cityCounts[a.city]         || 0) + 1;
        });

        const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
        const topCity      = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0];
        document.getElementById('adsTopCategory').textContent = topCategory ? topCategory[0] : '—';
        document.getElementById('adsTopCity').textContent      = topCity ? topCity[0] : '—';

        // تعبئة فلتر المدن ديناميكياً من المدن الموجودة فعلياً بالإعلانات
        const citySelect = document.getElementById('adsCityFilter');
        const cities     = [...new Set(allAds.map(a => a.city))].sort();
        citySelect.innerHTML = '<option value="">كل المدن</option>' + cities.map(c => `<option value="${c}">${c}</option>`).join('');

        renderAdsAdminTable();
    } catch (e) {}
}

function renderAdsAdminTable() {
    const search   = (document.getElementById('adsSearchInput').value || '').trim().toLowerCase();
    const category = document.getElementById('adsCategoryFilter').value;
    const city     = document.getElementById('adsCityFilter').value;
    const status   = document.getElementById('adsStatusFilter').value;
    const adType   = document.getElementById('adsTypeFilter').value;

    let list = allAds;
    if (search)   list = list.filter(a => a.title.toLowerCase().includes(search) || (a.provider_name || '').toLowerCase().includes(search));
    if (category) list = list.filter(a => a.category === category);
    if (city)     list = list.filter(a => a.city === city);
    if (status !== '') list = list.filter(a => String(a.is_active) === status);
    if (adType)   list = list.filter(a => (a.ad_type || 'service') === adType);

    document.getElementById('allAdsTable').innerHTML = list.map(a => `
        <tr>
            <td>#${a.id}</td>
            <td>${adThumbCell(a)}</td>
            <td>${a.title}</td>
            <td>${a.provider_name || '—'}${a.provider_username ? ` <span style="color:var(--text3)">@${a.provider_username}</span>` : ''}<br><span style="font-size:11px;color:var(--text3)" dir="ltr">+966${a.provider_phone}</span></td>
            <td>${a.category}</td>
            <td>${a.ad_type === 'sale' ? '<span class="badge" style="background:#F5C518;color:#111111">بيع</span>' : '<span class="badge" style="background:#F5C518;color:#111111">خدمة</span>'}</td>
            <td>${a.city}${a.district ? ' — ' + a.district : ''}</td>
            <td>${a.price_to ? `${a.price_from}-${a.price_to}` : (a.ad_type === 'sale' ? `${a.price_from}` : `من ${a.price_from}`)} ر</td>
            <td>${a.views_count}</td>
            <td>${a.avg_rating ? `⭐ ${a.avg_rating} (${a.reviews_count})` : '—'}</td>
            <td>${a.comments_count || 0} <button class="btn-detail" onclick="openAdCommentsPanel(${a.id}, '${(a.title || '').replace(/'/g, "\\'")}')">عرض</button></td>
            <td>${a.is_active ? '<span class="badge badge-done">نشط</span>' : '<span class="badge badge-gray">موقوف</span>'}</td>
            <td>
                <button class="btn-detail" onclick="toggleAdStatusAdmin(${a.id}, ${a.is_active ? 0 : 1})">${a.is_active ? 'إيقاف' : 'تفعيل'}</button>
                <button class="btn-detail" style="color:var(--red)" onclick="deleteAdAdmin(${a.id})">حذف</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="13" style="text-align:center;color:var(--text3)">لا توجد إعلانات مطابقة</td></tr>';
}

// صورة مصغرة لأول صورة بالإعلان (أو أيقونة القسم لو بدون صور) — تُستخدم بجدول "إدارة الإعلانات" ولوحة تحكم الإعلانات
function adThumbCell(a) {
    let firstImg = null;
    try { const imgs = JSON.parse(a.images || '[]'); if (imgs.length) firstImg = imgs[0]; } catch (e) {}
    return firstImg
        ? `<img src="${firstImg}" style="width:38px;height:38px;border-radius:8px;object-fit:cover"/>`
        : `<div style="width:38px;height:38px;border-radius:8px;background:#f5f5f5;display:flex;align-items:center;justify-content:center"><svg class="icon" style="color:var(--text3)"><use href="icons.svg#icon-broadcast"></use></svg></div>`;
}

// ══ عرض/إدارة تعليقات إعلان (panel جانبي) ══

let currentAdCommentsId = null;

async function openAdCommentsPanel(adId, adTitle) {
    currentAdCommentsId = adId;
    document.getElementById('adCommentsPanelTitle').textContent = adTitle || `#${adId}`;
    document.getElementById('adCommentsPanelOverlay').style.display = 'block';
    await loadAdCommentsPanel();
}

function closeAdCommentsPanel() {
    document.getElementById('adCommentsPanelOverlay').style.display = 'none';
    currentAdCommentsId = null;
}

async function loadAdCommentsPanel() {
    if (!currentAdCommentsId) return;

    try {
        const res  = await fetch(`${API}/comments/${currentAdCommentsId}?includeHidden=1`);
        const data = await res.json();
        if (!data.success) return;

        document.getElementById('adCommentsPanelSub').textContent = `${data.comments.length} تعليق`;

        document.getElementById('adCommentsPanelList').innerHTML = data.comments.map(c => `
            <div class="ad-comment-row">
                <div class="ad-comment-row-top">
                    <span class="ad-comment-row-name">${c.commenter_name || 'مستخدم'}${!c.is_visible ? ' <span class="badge badge-gray">مخفي</span>' : ''}</span>
                    <span class="ad-comment-row-time">${new Date(c.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('ar-SA')}</span>
                </div>
                <div class="ad-comment-row-text">${c.comment}</div>
                <button class="btn-detail" onclick="toggleCommentVisibility(${c.id}, ${c.is_visible ? 0 : 1})">${c.is_visible ? 'إخفاء' : 'إظهار'}</button>
                <button class="btn-detail" style="color:var(--red)" onclick="deleteCommentAdmin(${c.id})">حذف</button>
            </div>
        `).join('') || '<p style="text-align:center;color:var(--text3);padding:20px">لا توجد تعليقات</p>';
    } catch (e) {}
}

async function toggleCommentVisibility(id, isVisible) {
    try {
        await fetch(`${API}/comments/${id}/hide`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isVisible: !!isVisible }),
        });
        loadAdCommentsPanel();
        loadAdsAdminPage();
    } catch (e) {}
}

async function deleteCommentAdmin(id) {
    if (!confirm('هل أنت متأكد من حذف هذا التعليق نهائياً؟')) return;

    try {
        await fetch(`${API}/comments/${id}`, { method: 'DELETE' });
        loadAdCommentsPanel();
        loadAdsAdminPage();
    } catch (e) {}
}

async function toggleAdStatusAdmin(id, newState) {
    try {
        const res  = await fetch(`${API}/ads/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: !!newState }),
        });
        const data = await res.json();
        if (data.success) {
            loadAdsAdminPage();
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function deleteAdAdmin(id) {
    if (!confirm('هل أنت متأكد من حذف هذا الإعلان نهائياً؟')) return;

    try {
        await fetch(`${API}/ads/${id}`, { method: 'DELETE' });
        loadAdsAdminPage();
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// ══ لوحة تحكم الإعلانات (وضع الإعلانات) ══

async function loadAdsDashboardPage() {
    try {
        const [adsRes, usersRes, commentsRes, complaintsRes] = await Promise.all([
            fetch(`${API}/ads?includeInactive=1`),
            fetch(`${API}/users`),
            fetch(`${API}/comments?includeHidden=1`),
            fetch(`${API}/complaints`),
        ]);
        const adsData        = await adsRes.json();
        const usersData      = await usersRes.json();
        const commentsData   = await commentsRes.json();
        const complaintsData = await complaintsRes.json();
        if (!adsData.success || !usersData.success) return;

        const ads      = adsData.ads;
        const users     = usersData.users;
        const comments  = commentsData.success ? commentsData.comments : [];
        const complaints = complaintsData.success ? complaintsData.complaints : [];
        const todayStr   = new Date().toISOString().slice(0, 10);

        document.getElementById('ad-s-activeAds').textContent     = ads.filter(a => a.is_active).length;
        document.getElementById('ad-s-totalMembers').textContent  = users.length;
        document.getElementById('ad-s-featuredAds').textContent   = ads.filter(a => a.is_featured).length;
        document.getElementById('ad-s-totalViews').textContent    = ads.reduce((sum, a) => sum + (a.views_count || 0), 0);
        document.getElementById('ad-s-todayComments').textContent = comments.filter(c => (c.created_at || '').slice(0, 10) === todayStr).length;
        document.getElementById('ad-s-newReports').textContent    = complaints.filter(c => c.ad_id && c.status === 'new').length;

        // أكثر الأقسام نشاطاً — أشرطة نسبة
        const categoryCounts = {};
        ads.forEach(a => { categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1; });
        const maxCount = Math.max(1, ...Object.values(categoryCounts));
        const categories = ['سطحة', 'حاوية', 'معدات ثقيلة'];
        document.getElementById('adsDashCategoryBars').innerHTML = categories.map(cat => {
            const count = categoryCounts[cat] || 0;
            const pct   = Math.round((count / maxCount) * 100);
            return `
                <div style="margin-bottom:12px">
                    <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span>${cat}</span><span style="color:var(--text3)">${count}</span></div>
                    <div style="background:var(--gray);border-radius:6px;height:8px;overflow:hidden"><div style="background:var(--gold);height:100%;width:${pct}%"></div></div>
                </div>
            `;
        }).join('');

        // تنبيهات
        const reportedCount   = complaints.filter(c => c.ad_id && c.status !== 'resolved' && c.status !== 'closed').length;
        const unverifiedCount = users.filter(u => !u.is_verified).length;
        document.getElementById('adsDashAlerts').innerHTML = `
            <div style="padding:8px 0;border-bottom:1px solid var(--gray2)">📢 إعلانات بلغ عنها (قيد المراجعة): <strong>${reportedCount}</strong></div>
            <div style="padding:8px 0">⚠️ أعضاء غير موثقين: <strong>${unverifiedCount}</strong></div>
        `;

        // آخر 10 إعلانات منشورة
        const recentAds = [...ads].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);
        document.getElementById('adsDashRecentAds').innerHTML = recentAds.map(a => `
            <tr>
                <td>${adThumbCell(a)}</td>
                <td>${a.title}</td>
                <td>${a.category}</td>
                <td>${a.city}</td>
                <td>${new Date(a.created_at).toLocaleDateString('ar-SA')}</td>
                <td>
                    <button class="btn-detail" onclick="window.open('ad-details.html?id=${a.id}','_blank')">عرض</button>
                    <button class="btn-detail" style="color:var(--red)" onclick="deleteAdAdmin(${a.id})">حذف</button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text3)">لا توجد إعلانات بعد</td></tr>';

        // آخر 5 أعضاء مسجّلين
        const recentMembers = [...users].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
        document.getElementById('adsDashRecentMembers').innerHTML = recentMembers.map(u => `
            <tr>
                <td>${u.name || 'عضو'}</td>
                <td style="color:var(--text3)">${u.username ? '@' + u.username : '—'}</td>
                <td>${new Date(u.created_at).toLocaleDateString('ar-SA')}</td>
            </tr>
        `).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--text3)">لا يوجد أعضاء بعد</td></tr>';
    } catch (e) {}
}

// ══ إدارة الأعضاء (وضع الإعلانات) ══

let allMembersCache = [];

async function loadMembersPage() {
    try {
        const res  = await fetch(`${API}/users`);
        const data = await res.json();
        if (!data.success) return;
        allMembersCache = data.users;
        renderMembersTable();
    } catch (e) {}
}

function renderMembersTable() {
    const filter = document.getElementById('membersFilter').value;
    const now    = new Date();

    let members = allMembersCache;
    if (filter === 'verified')   members = members.filter(u => u.is_verified);
    if (filter === 'unverified') members = members.filter(u => !u.is_verified);
    if (filter === 'suspended')  members = members.filter(u => u.suspended_until && new Date(u.suspended_until.replace(' ', 'T') + 'Z') > now);

    document.getElementById('allMembersTable').innerHTML = members.map(u => {
        const isSuspended = u.suspended_until && new Date(u.suspended_until.replace(' ', 'T') + 'Z') > now;
        return `
            <tr>
                <td>#${u.id}</td>
                <td>${u.name || 'عضو'}${u.username ? ` <span style="color:var(--text3)">@${u.username}</span>` : ''}</td>
                <td dir="ltr">+966${u.phone}</td>
                <td>🪙 ${u.coins_balance || 0}</td>
                <td>${u.ads_count || 0}</td>
                <td>${u.is_verified
                    ? '<span style="color:#10B981;font-weight:700">✅ موثق</span>'
                    : '<span style="color:var(--text3)">غير موثق</span>'}</td>
                <td>${new Date(u.created_at).toLocaleDateString('ar-SA')}</td>
                <td style="white-space:nowrap">
                    ${u.is_verified
                        ? `<button class="btn-detail" onclick="unverifyMemberAds('${u.phone}')">إلغاء التوثيق</button>`
                        : `<button class="btn-detail" style="background:#10B981;color:#fff;border-color:#10B981" onclick="verifyMemberAds('${u.phone}')">توثيق ✅</button>`}
                    <button class="btn-detail" onclick="giftCoinsToMember('${u.phone}')">🪙 هدية</button>
                    ${isSuspended
                        ? `<button class="btn-detail" onclick="unsuspendMember('${u.phone}')">تفعيل</button>`
                        : `<button class="btn-detail" style="color:var(--red)" onclick="suspendMember('${u.phone}')">إيقاف</button>`}
                    <button class="btn-detail" style="color:var(--red)" onclick="deleteMemberAds('${u.phone}')">حذف</button>
                </td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--text3)">لا يوجد أعضاء مطابقون</td></tr>';
}

async function verifyMemberAds(phone) {
    if (!confirm('توثيق هذا الحساب؟ ستظهر علامة ✅ بجانب اسمه بكل أنحاء المنصة.')) return;
    try {
        const adminUsername = sessionStorage.getItem('yashjub_admin_name') || 'admin';
        const res  = await fetch(`${API}/users/${phone}/verify`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ adminUsername }),
        });
        const data = await res.json();
        if (data.success) loadMembersPage();
        else alert(`❌ ${data.message}`);
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function unverifyMemberAds(phone) {
    if (!confirm('إلغاء توثيق هذا الحساب؟')) return;
    try {
        const res  = await fetch(`${API}/users/${phone}/unverify`, { method: 'PUT' });
        const data = await res.json();
        if (data.success) loadMembersPage();
        else alert(`❌ ${data.message}`);
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function giftCoinsToMember(phone) {
    const amount = prompt('كم عدد العملات الذهبية اللي تبي تضيفها لهذا العضو؟');
    if (amount === null) return;
    const n = parseInt(amount, 10);
    if (!n || n <= 0) { alert('❌ أدخل عدد عملات صحيح'); return; }
    const reason = prompt('سبب الهدية (اختياري):') || '';

    try {
        const res  = await fetch(`${API}/coins/gift`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ phone, amount: n, reason }),
        });
        const data = await res.json();
        if (data.success) { alert(`✅ تمت إضافة ${n} عملة — الرصيد الجديد: ${data.balance}`); loadMembersPage(); }
        else alert(`❌ ${data.message}`);
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function suspendMember(phone) {
    const duration = prompt('مدة الإيقاف — اكتب: day (يوم) / week (أسبوع) / month (شهر)', 'week');
    if (!duration || !['day', 'week', 'month'].includes(duration.trim())) {
        if (duration !== null) alert('❌ اكتب واحدة من: day أو week أو month');
        return;
    }
    if (!confirm('هل أنت متأكد من إيقاف هذا الحساب مؤقتاً؟')) return;

    try {
        const res  = await fetch(`${API}/users/${phone}/suspend`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ duration: duration.trim() }),
        });
        const data = await res.json();
        if (data.success) loadMembersPage();
        else alert(`❌ ${data.message}`);
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function unsuspendMember(phone) {
    if (!confirm('تفعيل هذا الحساب الآن؟')) return;
    try {
        await fetch(`${API}/users/${phone}/unsuspend`, { method: 'PUT' });
        loadMembersPage();
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function deleteMemberAds(phone) {
    if (!confirm('هل أنت متأكد من حذف هذا الحساب نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.')) return;
    try {
        await fetch(`${API}/users/${phone}`, { method: 'DELETE' });
        loadMembersPage();
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// ══ إدارة التعليقات (وضع الإعلانات) ══

let allCommentsCache = [];

async function loadCommentsAdminPage() {
    try {
        const res  = await fetch(`${API}/comments?includeHidden=1`);
        const data = await res.json();
        if (!data.success) return;
        allCommentsCache = data.comments;
        renderCommentsAdminTable();
    } catch (e) {}
}

function renderCommentsAdminTable() {
    document.getElementById('allCommentsTable').innerHTML = allCommentsCache.map(c => `
        <tr>
            <td>#${c.id}</td>
            <td>${c.comment}</td>
            <td>${c.commenter_name || 'مستخدم'}${c.commenter_username ? ` <span style="color:var(--text3)">@${c.commenter_username}</span>` : ''}</td>
            <td>${c.ad_title ? `<a href="ad-details.html?id=${c.ad_id}" target="_blank">${c.ad_title}</a>` : '—'}</td>
            <td>${new Date(c.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('ar-SA')}</td>
            <td>${c.is_visible ? '<span class="badge badge-done">ظاهر</span>' : '<span class="badge badge-gray">مخفي</span>'}</td>
            <td>
                <button class="btn-detail" onclick="toggleCommentVisibilityGlobal(${c.id}, ${c.is_visible ? 0 : 1})">${c.is_visible ? 'إخفاء' : 'إظهار'}</button>
                <button class="btn-detail" style="color:var(--red)" onclick="deleteCommentGlobal(${c.id})">حذف</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text3)">لا توجد تعليقات بعد</td></tr>';
}

async function toggleCommentVisibilityGlobal(id, isVisible) {
    try {
        await fetch(`${API}/comments/${id}/hide`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isVisible: !!isVisible }),
        });
        loadCommentsAdminPage();
    } catch (e) {}
}

async function deleteCommentGlobal(id) {
    if (!confirm('هل أنت متأكد من حذف هذا التعليق نهائياً؟')) return;
    try {
        await fetch(`${API}/comments/${id}`, { method: 'DELETE' });
        loadCommentsAdminPage();
    } catch (e) {}
}

// ══ إدارة العملات (وضع الإعلانات) ══

let allCoinsTransactions = [];
let allCoinsPackagesCache = [];

async function loadCoinsAdminPage() {
    try {
        const [txRes, packRes] = await Promise.all([
            fetch(`${API}/coins/transactions`),
            fetch(`${API}/coins/packages?includeInactive=1`),
        ]);
        const txData   = await txRes.json();
        const packData = await packRes.json();
        if (!txData.success || !packData.success) return;

        allCoinsTransactions  = txData.transactions;
        allCoinsPackagesCache = packData.packages;

        const purchases = allCoinsTransactions.filter(t => t.type === 'purchase');
        const spends     = allCoinsTransactions.filter(t => t.type === 'spend');

        const sold   = purchases.reduce((sum, t) => sum + t.amount, 0);
        const spent  = spends.reduce((sum, t) => sum + t.amount, 0);
        const revenue = purchases.reduce((sum, t) => {
            const pack = allCoinsPackagesCache.find(p => p.total_coins === t.amount);
            return sum + (pack ? pack.price : 0);
        }, 0);
        const spenderPhones = new Set(spends.map(t => t.phone));
        const avgSpend = spenderPhones.size ? Math.round(spent / spenderPhones.size) : 0;

        document.getElementById('coins-s-sold').textContent    = sold;
        document.getElementById('coins-s-revenue').textContent = `${revenue.toFixed(2)} ر`;
        document.getElementById('coins-s-spent').textContent   = spent;
        document.getElementById('coins-s-avgSpend').textContent = avgSpend;

        renderCoinsPackagesTable();
        renderCoinsPurchasesTable();
    } catch (e) {}
}

function renderCoinsPackagesTable() {
    document.getElementById('coinsPackagesTable').innerHTML = allCoinsPackagesCache.map(p => `
        <tr>
            <td>#${p.id}</td>
            <td>${p.name}</td>
            <td>${p.coins}</td>
            <td>${p.bonus_coins}</td>
            <td>${p.total_coins}</td>
            <td>${p.price} ر</td>
            <td>${p.is_popular ? '⭐' : '—'}</td>
            <td>${p.is_active ? '<span class="badge badge-done">نشطة</span>' : '<span class="badge badge-gray">موقوفة</span>'}</td>
            <td>
                <button class="btn-detail" onclick="editCoinsPackage(${p.id})">تعديل</button>
                <button class="btn-detail" onclick="toggleCoinsPackageActive(${p.id}, ${p.is_active ? 0 : 1})">${p.is_active ? 'إيقاف' : 'تفعيل'}</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="9" style="text-align:center;color:var(--text3)">لا توجد باقات بعد</td></tr>';
}

function renderCoinsPurchasesTable() {
    const purchases = allCoinsTransactions.filter(t => t.type === 'purchase');
    document.getElementById('coinsPurchasesTable').innerHTML = purchases.map(t => `
        <tr>
            <td>#${t.id}</td>
            <td>${t.user_name || 'مستخدم'}${t.user_username ? ` <span style="color:var(--text3)">@${t.user_username}</span>` : ''}</td>
            <td>🪙 ${t.amount}</td>
            <td>${t.description || '—'}</td>
            <td>${new Date(t.created_at.replace(' ', 'T') + 'Z').toLocaleString('ar-SA')}</td>
        </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text3)">لا توجد مشتريات بعد</td></tr>';
}

async function editCoinsPackage(id) {
    const pack = allCoinsPackagesCache.find(p => p.id === id);
    if (!pack) return;

    const name = prompt('اسم الباقة:', pack.name);
    if (name === null) return;
    const coins = prompt('عدد العملات الأساسية:', pack.coins);
    if (coins === null || !parseInt(coins, 10)) { alert('❌ عدد عملات غير صحيح'); return; }
    const bonus = prompt('عدد عملات البونص:', pack.bonus_coins);
    if (bonus === null) return;
    const price = prompt('السعر (ريال):', pack.price);
    if (price === null || !parseFloat(price)) { alert('❌ سعر غير صحيح'); return; }
    const isPopular = confirm('هل تريد تمييز هذي الباقة بـ"الأكثر شعبية" ⭐؟');

    try {
        const res  = await fetch(`${API}/coins/packages/${id}`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ name, coins: parseInt(coins, 10), bonusCoins: parseInt(bonus, 10) || 0, price: parseFloat(price), isPopular }),
        });
        const data = await res.json();
        if (data.success) loadCoinsAdminPage();
        else alert(`❌ ${data.message}`);
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function toggleCoinsPackageActive(id, newState) {
    try {
        await fetch(`${API}/coins/packages/${id}`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ isActive: !!newState }),
        });
        loadCoinsAdminPage();
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function addNewCoinsPackage() {
    const name = prompt('اسم الباقة الجديدة:');
    if (!name) return;
    const coins = prompt('عدد العملات الأساسية:');
    if (!parseInt(coins, 10)) { alert('❌ عدد عملات غير صحيح'); return; }
    const bonus = prompt('عدد عملات البونص (اختياري):', '0');
    const price = prompt('السعر (ريال):');
    if (!parseFloat(price)) { alert('❌ سعر غير صحيح'); return; }

    try {
        const res  = await fetch(`${API}/coins/packages`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ name, coins: parseInt(coins, 10), bonusCoins: parseInt(bonus, 10) || 0, price: parseFloat(price) }),
        });
        const data = await res.json();
        if (data.success) loadCoinsAdminPage();
        else alert(`❌ ${data.message}`);
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function submitGiftCoinsForm() {
    const phone  = document.getElementById('giftPhoneInput').value.trim();
    const amount = parseInt(document.getElementById('giftAmountInput').value, 10);
    const reason = document.getElementById('giftReasonInput').value.trim();

    if (!phone || !amount || amount <= 0) {
        alert('❌ أدخل رقم جوال وعدد عملات صحيحين');
        return;
    }

    try {
        const res  = await fetch(`${API}/coins/gift`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ phone, amount, reason }),
        });
        const data = await res.json();
        if (data.success) {
            alert(`✅ تمت إضافة ${amount} عملة — الرصيد الجديد: ${data.balance}`);
            document.getElementById('giftPhoneInput').value  = '';
            document.getElementById('giftAmountInput').value = '';
            document.getElementById('giftReasonInput').value = '';
            loadCoinsAdminPage();
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// ══ رسوم المعاهدة (وضع الإعلانات) ══

async function loadFeesAdminPage() {
    try {
        const [feesRes, adsRes] = await Promise.all([
            fetch(`${API}/fees`),
            fetch(`${API}/ads?includeInactive=1`),
        ]);
        const feesData = await feesRes.json();
        const adsData  = await adsRes.json();
        if (!feesData.success || !adsData.success) return;

        const payments = feesData.payments;
        const ads       = adsData.ads;

        const total  = payments.reduce((sum, p) => sum + p.fee_amount, 0);
        const payerPhones = new Set(payments.map(p => p.provider_phone));
        document.getElementById('fees-s-total').textContent  = `${total.toFixed(2)} ر`;
        document.getElementById('fees-s-count').textContent  = payments.length;
        document.getElementById('fees-s-payers').textContent = payerPhones.size;

        document.getElementById('feesPaymentsTable').innerHTML = payments.map(p => `
            <tr>
                <td>#${p.id}</td>
                <td>${p.provider_name || 'معلن'}${p.provider_username ? ` <span style="color:var(--text3)">@${p.provider_username}</span>` : ''}</td>
                <td>${p.service_amount} ر</td>
                <td>${p.fee_amount} ر</td>
                <td>${p.payment_method}</td>
                <td>${new Date(p.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('ar-SA')}</td>
            </tr>
        `).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text3)">لا توجد دفعات مسجّلة بعد</td></tr>';

        // معلنون نشروا إعلانات بس ما سجّلوا أي دفعة رسوم بعد — بيانات حقيقية (مو تخمين "تأخر")
        const adsByProvider = {};
        ads.forEach(a => {
            if (!adsByProvider[a.provider_phone]) adsByProvider[a.provider_phone] = { name: a.provider_name, username: a.provider_username, count: 0 };
            adsByProvider[a.provider_phone].count++;
        });
        const unpaid = Object.entries(adsByProvider).filter(([phone]) => !payerPhones.has(phone));

        document.getElementById('feesUnpaidTable').innerHTML = unpaid.map(([phone, info]) => `
            <tr>
                <td>${info.name || 'معلن'}${info.username ? ` <span style="color:var(--text3)">@${info.username}</span>` : ''}</td>
                <td>${info.count}</td>
                <td><button class="btn-detail" onclick="sendFeeReminder('${phone}')">🔔 إرسال تذكير</button></td>
            </tr>
        `).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--text3)">كل المعلنين سجّلوا دفعة رسوم على الأقل 🎉</td></tr>';
    } catch (e) {}
}

async function sendFeeReminder(phone) {
    try {
        await fetch(`${API}/notifications/send`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                title:   'تذكير — رسوم معاهدة عتاد',
                message: 'يرجى تسجيل دفعة رسوم معاهدة عتاد (1% من قيمة الخدمات اللي نفّذتها عبر إعلاناتك) من صفحة "حاسبة الرسوم والدفع".',
                type:    'alert',
                target:  'specific',
                targetPhone: phone,
            }),
        });
        alert('✅ تم إرسال التذكير');
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// ══ التقارير المالية (وضع الإعلانات) ══

let financialChartsInstances = [];

async function loadFinancialReportsPage() {
    try {
        const [txRes, packRes, feesRes] = await Promise.all([
            fetch(`${API}/coins/transactions`),
            fetch(`${API}/coins/packages?includeInactive=1`),
            fetch(`${API}/fees`),
        ]);
        const txData   = await txRes.json();
        const packData = await packRes.json();
        const feesData = await feesRes.json();
        if (!txData.success || !packData.success || !feesData.success) return;

        const purchases = txData.transactions.filter(t => t.type === 'purchase');
        const spends     = txData.transactions.filter(t => t.type === 'spend');
        const packages   = packData.packages;
        const payments   = feesData.payments;

        // تجميع شهري (آخر 6 أشهر فعلياً موجودين بالبيانات، أو الشهر الحالي لو ماكو بيانات بعد)
        const monthKey = s => (s || '').slice(0, 7);
        const months   = [...new Set([...purchases, ...payments].map(r => monthKey(r.created_at)))].sort().slice(-6);
        const monthLabels = months.length ? months : [new Date().toISOString().slice(0, 7)];

        const coinsRevenueByMonth = monthLabels.map(m => purchases
            .filter(t => monthKey(t.created_at) === m)
            .reduce((sum, t) => {
                const pack = packages.find(p => p.total_coins === t.amount);
                return sum + (pack ? pack.price : 0);
            }, 0));

        const feesByMonth = monthLabels.map(m => payments
            .filter(p => monthKey(p.created_at) === m)
            .reduce((sum, p) => sum + p.fee_amount, 0));

        buildFinancialCharts(monthLabels, coinsRevenueByMonth, feesByMonth);

        // أكثر المستخدمين إنفاقاً
        const spendByPhone = {};
        spends.forEach(t => {
            if (!spendByPhone[t.phone]) spendByPhone[t.phone] = { name: t.user_name, username: t.user_username, total: 0 };
            spendByPhone[t.phone].total += t.amount;
        });
        const topSpenders = Object.values(spendByPhone).sort((a, b) => b.total - a.total).slice(0, 10);

        document.getElementById('topSpendersTable').innerHTML = topSpenders.map((s, i) => `
            <tr>
                <td>#${i + 1}</td>
                <td>${s.name || 'مستخدم'}${s.username ? ` <span style="color:var(--text3)">@${s.username}</span>` : ''}</td>
                <td>🪙 ${s.total}</td>
            </tr>
        `).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--text3)">لا يوجد إنفاق بعد</td></tr>';
    } catch (e) {}
}

function buildFinancialCharts(labels, coinsRevenue, fees) {
    financialChartsInstances.forEach(c => c.destroy());
    financialChartsInstances = [];

    const ctx1 = document.getElementById('coinsRevenueChart').getContext('2d');
    financialChartsInstances.push(new Chart(ctx1, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'إيرادات العملات', data: coinsRevenue, backgroundColor: '#F5C518', borderRadius: 6 }] },
        options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { family: 'Cairo', size: 10 } } }, y: { grid: { color: '#f0f0f0' }, ticks: { font: { family: 'Cairo', size: 10 } } } } },
    }));

    const ctx2 = document.getElementById('feesChart').getContext('2d');
    financialChartsInstances.push(new Chart(ctx2, {
        type: 'line',
        data: { labels, datasets: [{ label: 'رسوم المعاهدة', data: fees, borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.08)', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 2 }] },
        options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { family: 'Cairo', size: 10 } } }, y: { grid: { color: '#f0f0f0' }, ticks: { font: { family: 'Cairo', size: 10 } } } } },
    }));
}

// ══ إعدادات الأقسام (وضع الإعلانات) ══

let allAdCategoriesCache = [];

async function loadAdCategoriesSettingsPage() {
    try {
        const [catRes, adsRes] = await Promise.all([
            fetch(`${API}/ad-categories`),
            fetch(`${API}/ads?includeInactive=1`),
        ]);
        const catData = await catRes.json();
        const adsData = await adsRes.json();
        if (!catData.success) return;

        allAdCategoriesCache = catData.categories;
        const adsCountByCategory = {};
        if (adsData.success) adsData.ads.forEach(a => { adsCountByCategory[a.category] = (adsCountByCategory[a.category] || 0) + 1; });

        document.getElementById('adCategoriesTable').innerHTML = allAdCategoriesCache.map(c => `
            <tr>
                <td>#${c.id}</td>
                <td>${c.name}</td>
                <td>${c.name_en || '—'}</td>
                <td>${c.name_ur || '—'}</td>
                <td>${c.icon}</td>
                <td>${adsCountByCategory[c.name] || 0}</td>
                <td>${c.is_active ? '<span class="badge badge-done">نشط</span>' : '<span class="badge badge-gray">موقوف</span>'}</td>
                <td>
                    <button class="btn-detail" onclick="editAdCategory(${c.id})">تعديل</button>
                    <button class="btn-detail" onclick="toggleAdCategoryActive(${c.id}, ${c.is_active ? 0 : 1})">${c.is_active ? 'إيقاف' : 'تفعيل'}</button>
                    <button class="btn-detail" style="color:var(--red)" onclick="deleteAdCategory(${c.id})">حذف</button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--text3)">لا توجد أقسام بعد</td></tr>';
    } catch (e) {}
}

async function addNewAdCategory() {
    const name = prompt('اسم القسم بالعربي:');
    if (!name) return;
    const nameEn = prompt('الاسم بالإنجليزي (اختياري):') || '';
    const nameUr = prompt('الاسم بالأردو (اختياري):') || '';
    const icon   = prompt('اسم الأيقونة (من icons.svg، مثل: tow-truck):', 'broadcast');
    if (!icon) { alert('❌ لازم تحدد أيقونة'); return; }

    try {
        const res  = await fetch(`${API}/ad-categories`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ name, nameEn, nameUr, icon }),
        });
        const data = await res.json();
        if (data.success) loadAdCategoriesSettingsPage();
        else alert(`❌ ${data.message}`);
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function editAdCategory(id) {
    const cat = allAdCategoriesCache.find(c => c.id === id);
    if (!cat) return;

    const name = prompt('اسم القسم بالعربي:', cat.name);
    if (name === null) return;
    const nameEn = prompt('الاسم بالإنجليزي:', cat.name_en || '');
    if (nameEn === null) return;
    const nameUr = prompt('الاسم بالأردو:', cat.name_ur || '');
    if (nameUr === null) return;
    const icon = prompt('اسم الأيقونة:', cat.icon);
    if (!icon) { alert('❌ لازم تحدد أيقونة'); return; }

    try {
        const res  = await fetch(`${API}/ad-categories/${id}`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ name, nameEn, nameUr, icon }),
        });
        const data = await res.json();
        if (data.success) loadAdCategoriesSettingsPage();
        else alert(`❌ ${data.message}`);
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function toggleAdCategoryActive(id, newState) {
    try {
        await fetch(`${API}/ad-categories/${id}`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ isActive: !!newState }),
        });
        loadAdCategoriesSettingsPage();
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function deleteAdCategory(id) {
    if (!confirm('هل أنت متأكد من حذف هذا القسم؟ الإعلانات المنشورة فيه مسبقاً تبقى كما هي، بس القسم يختفي من قائمة الاختيار للإعلانات الجديدة.')) return;
    try {
        await fetch(`${API}/ad-categories/${id}`, { method: 'DELETE' });
        loadAdCategoriesSettingsPage();
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// ══ إعدادات العملات (وضع الإعلانات) ══

async function loadCoinsConfigPage() {
    try {
        const res  = await fetch(`${API}/config`);
        const data = await res.json();
        if (!data.success) return;
        document.getElementById('configFeatureCost').value  = data.config.feature_ad_coin_cost || 10;
        document.getElementById('configFeatureHours').value = data.config.feature_ad_duration_hours || 24;
    } catch (e) {}
}

async function saveCoinsConfig() {
    const cost  = document.getElementById('configFeatureCost').value;
    const hours = document.getElementById('configFeatureHours').value;
    if (!cost || !hours || cost <= 0 || hours <= 0) { alert('❌ أدخل قيم صحيحة'); return; }

    try {
        await Promise.all([
            fetch(`${API}/config/feature_ad_coin_cost`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: cost }) }),
            fetch(`${API}/config/feature_ad_duration_hours`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: hours }) }),
        ]);
        alert('✅ تم حفظ الإعدادات');
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// ══ إعدادات المعاهدة (وضع الإعلانات) ══

async function loadCovenantConfigPage() {
    try {
        const res  = await fetch(`${API}/config`);
        const data = await res.json();
        if (!data.success) return;
        document.getElementById('configFeePercent').value  = data.config.covenant_fee_percent || 1;
        document.getElementById('configPaymentDays').value = data.config.covenant_payment_days || 10;
    } catch (e) {}
}

async function saveCovenantConfig() {
    const percent = document.getElementById('configFeePercent').value;
    const days    = document.getElementById('configPaymentDays').value;
    if (!percent || !days || percent <= 0 || days <= 0) { alert('❌ أدخل قيم صحيحة'); return; }

    try {
        await Promise.all([
            fetch(`${API}/config/covenant_fee_percent`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: percent }) }),
            fetch(`${API}/config/covenant_payment_days`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: days }) }),
        ]);
        alert('✅ تم حفظ الإعدادات');
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// ══ إعدادات اللغات (وضع الإعلانات) ══

let allTranslationsCache = [];

async function loadTranslationsSettingsPage() {
    try {
        const res  = await fetch(`${API}/translations`);
        const data = await res.json();
        if (!data.success) return;
        allTranslationsCache = data.translations;
        renderTranslationsTable();
    } catch (e) {}
}

function renderTranslationsTable() {
    document.getElementById('translationsTable').innerHTML = allTranslationsCache.map(t => `
        <tr>
            <td>${t.ar_key}</td>
            <td><input type="text" id="trEn-${t.id}" value="${(t.en || '').replace(/"/g, '&quot;')}" style="width:100%;padding:6px 10px;border-radius:6px;border:1px solid var(--gray2);font-family:'Cairo',sans-serif;font-size:12px" dir="ltr"/></td>
            <td><input type="text" id="trUr-${t.id}" value="${(t.ur || '').replace(/"/g, '&quot;')}" style="width:100%;padding:6px 10px;border-radius:6px;border:1px solid var(--gray2);font-family:'Cairo',sans-serif;font-size:12px"/></td>
            <td><button class="btn-detail" onclick="saveTranslation('${t.ar_key}')">حفظ</button></td>
        </tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text3)">لا توجد ترجمات بعد</td></tr>';
}

async function saveTranslation(arKey) {
    const row = allTranslationsCache.find(t => t.ar_key === arKey);
    if (!row) return;
    const en = document.getElementById(`trEn-${row.id}`).value.trim();
    const ur = document.getElementById(`trUr-${row.id}`).value.trim();

    try {
        const res  = await fetch(`${API}/translations/${encodeURIComponent(arKey)}`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ en, ur }),
        });
        const data = await res.json();
        if (data.success) alert('✅ تم الحفظ');
        else alert(`❌ ${data.message}`);
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// ══ الكلمات المحظورة (وضع الإعلانات) ══

async function loadBannedWordsPage() {
    try {
        const [wordsRes, settingsRes] = await Promise.all([
            fetch(`${API}/banned-words`),
            fetch(`${API}/settings`),
        ]);
        const wordsData = await wordsRes.json();
        const settingsData = await settingsRes.json();
        if (!wordsData.success) return;

        if (settingsData.success) document.getElementById('bannedWordsFilterToggle').checked = !!settingsData.settings.banned_words_filter;

        document.getElementById('bannedWordsTable').innerHTML = wordsData.words.map(w => `
            <tr>
                <td>#${w.id}</td>
                <td>${w.word}</td>
                <td>${new Date(w.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('ar-SA')}</td>
                <td><button class="btn-detail" style="color:var(--red)" onclick="deleteBannedWord(${w.id})">حذف</button></td>
            </tr>
        `).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text3)">لا توجد كلمات محظورة بعد</td></tr>';
    } catch (e) {}
}

async function toggleBannedWordsFilter(enabled) {
    try {
        await fetch(`${API}/settings/banned_words_filter`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ value: enabled }),
        });
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function addBannedWord() {
    const word = document.getElementById('newBannedWordInput').value.trim();
    if (!word) return;

    try {
        const res  = await fetch(`${API}/banned-words`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ word }),
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('newBannedWordInput').value = '';
            loadBannedWordsPage();
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function deleteBannedWord(id) {
    if (!confirm('هل أنت متأكد من حذف هذي الكلمة من القائمة؟')) return;
    try {
        await fetch(`${API}/banned-words/${id}`, { method: 'DELETE' });
        loadBannedWordsPage();
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// تحقق من الجلسة
if (sessionStorage.getItem('yashjub_admin') === 'true') {
    const savedRole = sessionStorage.getItem('yashjub_admin_role') || 'admin';
    const savedName = sessionStorage.getItem('yashjub_admin_name') || 'المدير العام';

    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminLayout').style.display = 'flex';

    applyRolePermissions(savedRole, savedName);
    refreshSidebarBadges();

    const firstPage = savedRole === 'admin' ? 'adsDashboard' : (ROLE_PAGES[savedRole] || [])[0];
    if (firstPage) showPage(firstPage);
}