// كود لوحة الإدارة المتطورة

const API      = window.location.origin + '/api';
const ADMIN_PASS = 'yashjub2025';

// صلاحيات كل منصب — الصفحات المسموح للمنصب رؤيتها (admin يشوف كل شيء بدون قيود)
const ROLE_PAGES = {
    supervisor: ['orders', 'providers', 'clients'],
    support:    ['orders', 'complaints'],
    reviewer:   ['verification'],
    accountant: ['payments', 'commissions'],
};

const ROLE_LABELS = {
    admin:      { label: 'مدير عام',    class: 'badge-gold'    },
    supervisor: { label: 'مشرف',        class: 'badge-active'  },
    support:    { label: 'دعم فني',     class: 'badge-done'    },
    reviewer:   { label: 'مراجع توثيق', class: 'badge-purple'  },
    accountant: { label: 'محاسب',       class: 'badge-pending' },
};

let opsRefreshInterval = null;
let opsMap             = null;
let opsMapMarkers       = [];

let chatsListRefreshInterval = null;
let chatPanelRefreshInterval = null;
let allConversations         = [];
let currentChatFilter        = 'all';
let currentChatOrderId       = null;

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

    if ((user === 'admin' || user === 'يشجب') && pass === ADMIN_PASS) {
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

    if (role === 'admin') {
        loadDashboard();
    } else {
        const firstPage = (ROLE_PAGES[role] || [])[0];
        if (firstPage) showPage(firstPage);
    }
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

    // إيقاف التحديث التلقائي لمركز العمليات عند مغادرة صفحته
    if (opsRefreshInterval) {
        clearInterval(opsRefreshInterval);
        opsRefreshInterval = null;
    }

    // إيقاف التحديث التلقائي لقائمة المحادثات + إغلاق أي panel مفتوح عند مغادرة الصفحة
    if (page !== 'chats') {
        if (chatsListRefreshInterval) {
            clearInterval(chatsListRefreshInterval);
            chatsListRefreshInterval = null;
        }
        closeChatPanel();
    }

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

    if (page === 'orders')        loadOrdersPage();
    if (page === 'providers')     loadProvidersPage();
    if (page === 'clients')       loadClientsPage();
    if (page === 'employees')     loadEmployeesPage();
    if (page === 'commissions')   loadCommissionsPage();
    if (page === 'payments')      loadPaymentsPage();
    if (page === 'cities')        loadCitiesPage();
    if (page === 'coupons')       loadCouponsPage();
    if (page === 'services')      loadServicesPage();
    if (page === 'chats')         loadChatsPage();
    if (page === 'notifications') loadNotificationsPage();
    if (page === 'complaints')    loadComplaintsPage();
    if (page === 'reviews')       loadReviewsPage();
    if (page === 'testimonials')  loadTestimonialsPage();
    if (page === 'operations')    startOperationsPage();
}

// تحميل لوحة التحكم
async function loadDashboard() {
    try {
        const [ordersRes, providersRes, usersRes, commissionsRes] = await Promise.all([
            fetch(`${API}/orders`),
            fetch(`${API}/providers`),
            fetch(`${API}/users`),
            fetch(`${API}/reports/commissions`),
        ]);

        const ordersData      = await ordersRes.json();
        const providersData   = await providersRes.json();
        const usersData       = await usersRes.json();
        const commissionsData = await commissionsRes.json();

        const orders    = ordersData.success    ? ordersData.orders       : [];
        const providers = providersData.success ? providersData.providers : [];
        const users     = usersData.success     ? usersData.users         : [];

        // الإحصائيات
        const revenue    = orders.reduce((s, o) => s + o.price, 0);
        const commission = orders.reduce((s, o) => s + o.commission, 0);
        const completed  = orders.filter(o => o.status === 'completed');
        const pending    = orders.filter(o => o.status === 'pending');
        const cancelled  = orders.filter(o => o.status === 'cancelled');

        document.getElementById('s-revenue').textContent    = revenue.toLocaleString() + ' ر';
        document.getElementById('s-commission').textContent = commission.toLocaleString() + ' ر';
        document.getElementById('s-today').textContent      = orders.length;
        document.getElementById('s-active').textContent     = pending.length;
        document.getElementById('s-completed').textContent  = completed.length;
        document.getElementById('s-providers').textContent  = providers.length;
        document.getElementById('s-users').textContent      = users.length;

        document.getElementById('sc-active').textContent  = pending.length;
        document.getElementById('sc-pending').textContent = pending.length;
        document.getElementById('sc-done').textContent    = completed.length;
        document.getElementById('sc-cancel').textContent  = cancelled.length;

        document.getElementById('p-success').textContent = revenue.toLocaleString() + ' ر';
        if (commissionsData.success) {
            document.getElementById('c-today').textContent = commissionsData.today.toLocaleString();
            document.getElementById('c-week').textContent  = commissionsData.week.toLocaleString();
            document.getElementById('c-month').textContent = commissionsData.month.toLocaleString();
            document.getElementById('c-year').textContent  = commissionsData.year.toLocaleString();
        }

        document.getElementById('pendingBadge').textContent  = pending.length;
        document.getElementById('verifyBadge').textContent   = providers.length;

        // شارة المحادثات اللي تحتاج تدخل (تظهر من أي صفحة بلوحة الإدارة)
        fetchConversations();

        // تخزين أرقام العملاء/المزودين مؤقتاً (لمعاينة عدد المستلمين ولفلترة سجل الإشعارات) + شارة الإشعارات
        cachedClientPhones   = new Set(users.map(u => u.phone));
        cachedProviderPhones = new Set(providers.map(p => p.phone));
        fetchNotificationsBadge();

        // شارة الشكاوى الجديدة (تظهر من أي صفحة بلوحة الإدارة)
        fetchComplaintsData();

        // شارة التقييمات المشبوهة (تظهر من أي صفحة بلوحة الإدارة)
        fetchReviewsData();

        // شارة الشهادات المعلقة (تظهر من أي صفحة بلوحة الإدارة)
        fetchTestimonialsData();

        // آخر الطلبات
        const statusBadge = {
            pending:   '<span class="badge badge-pending">انتظار</span>',
            accepted:  '<span class="badge badge-active">مقبول</span>',
            completed: '<span class="badge badge-done">مكتمل</span>',
            cancelled: '<span class="badge badge-cancel">ملغي</span>',
        };

        document.getElementById('recentOrders').innerHTML = orders.slice(0,5).map(o => `
            <tr>
                <td>#${o.id}</td>
                <td>${o.service}</td>
                <td dir="ltr" style="font-size:12px">+966${o.phone}</td>
                <td>${o.price} ر</td>
                <td>${statusBadge[o.status] || o.status}</td>
            </tr>
        `).join('');

        // أكثر الموردين نشاطاً
        document.getElementById('topProviders').innerHTML = providers.slice(0,5).map(p => `
            <tr>
                <td>
                    <div style="display:flex;align-items:center;gap:8px">
                        <div class="provider-avatar-sm"><svg class="icon"><use href="icons.svg#icon-worker"></use></svg></div>
                        <div>
                            <div style="font-size:13px;font-weight:600">${p.name}</div>
                            <div style="font-size:11px;color:var(--text3)">${p.service_type}</div>
                        </div>
                    </div>
                </td>
                <td>٠</td>
                <td><svg class="icon"><use href="icons.svg#icon-star"></use></svg> ${p.rating}</td>
                <td style="color:var(--gold)">٠ ر</td>
                <td style="color:var(--green)">٠٪</td>
            </tr>
        `).join('');

        // الرسوم البيانية
        buildCharts(orders);

    } catch(e) {
        console.log('خطأ في تحميل البيانات', e);
    }
}

// الرسوم البيانية
function buildCharts(orders) {
    // مخطط الطلبات
    const ctx1 = document.getElementById('ordersChart').getContext('2d');
    new Chart(ctx1, {
        type: 'line',
        data: {
            labels: Array.from({length:30}, (_,i) => `${i+1}`),
            datasets: [{
                label: 'الطلبات',
                data: Array.from({length:30}, () => Math.floor(Math.random()*20+5)),
                borderColor: '#F5C518',
                backgroundColor: 'rgba(245,197,24,0.08)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { font: { family: 'Cairo' }, maxTicksLimit: 10 } },
                y: { grid: { color: '#f0f0f0' }, ticks: { font: { family: 'Cairo' } } }
            }
        }
    });

    // مخطط الإيرادات
    const ctx2 = document.getElementById('revenueChart').getContext('2d');
    new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],
            datasets: [{
                label: 'الإيرادات',
                data: [12000,18000,15000,22000,19000,25000,28000,24000,30000,26000,32000,35000],
                backgroundColor: '#F5C518',
                borderRadius: 6,
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { font: { family: 'Cairo', size: 10 } } },
                y: { grid: { color: '#f0f0f0' }, ticks: { font: { family: 'Cairo', size: 10 } } }
            }
        }
    });
}

// صفحة الطلبات
async function loadOrdersPage() {
    try {
        const res  = await fetch(`${API}/orders`);
        const data = await res.json();
        if (!data.success) return;

        const statusBadge = {
            pending:   '<span class="badge badge-pending">انتظار</span>',
            accepted:  '<span class="badge badge-active">مقبول</span>',
            completed: '<span class="badge badge-done">مكتمل</span>',
            cancelled: '<span class="badge badge-cancel">ملغي</span>',
        };

        document.getElementById('allOrdersTable').innerHTML = data.orders.map(o => `
            <tr>
                <td><strong>#${o.id}</strong></td>
                <td>${o.service}</td>
                <td dir="ltr">+966${o.phone}</td>
                <td>الرياض</td>
                <td>${o.price} ر</td>
                <td style="color:var(--gold)">${o.commission} ر</td>
                <td>${statusBadge[o.status] || o.status}</td>
                <td>${new Date(o.created_at).toLocaleDateString('ar-SA')}</td>
                <td>
                    <select onchange="updateStatus(${o.id},this.value)"
                        style="font-family:Cairo,sans-serif;font-size:12px;padding:4px 8px;border-radius:6px;border:1px solid #ddd;cursor:pointer">
                        <option value="pending"   ${o.status==='pending'   ?'selected':''}>انتظار</option>
                        <option value="accepted"  ${o.status==='accepted'  ?'selected':''}>قبول</option>
                        <option value="completed" ${o.status==='completed' ?'selected':''}>مكتمل</option>
                        <option value="cancelled" ${o.status==='cancelled' ?'selected':''}>إلغاء</option>
                    </select>
                </td>
            </tr>
        `).join('');
    } catch(e) {}
}

// صفحة الموردين
async function loadProvidersPage() {
    try {
        const res  = await fetch(`${API}/providers`);
        const data = await res.json();
        if (!data.success) return;

        const levelLabel = {
            basic:'<svg class="icon"><use href="icons.svg#icon-medal-silver"></use></svg> أساسي',
            verified:'<svg class="icon"><use href="icons.svg#icon-medal-gold"></use></svg> موثق',
            business:'<svg class="icon"><use href="icons.svg#icon-trophy"></use></svg> شركة'
        };

        document.getElementById('allProvidersTable').innerHTML = data.providers.map(p => `
            <tr>
                <td>#${p.id}</td>
                <td>
                    <div style="display:flex;align-items:center;gap:8px">
                        <div style="width:32px;height:32px;border-radius:50%;background:#f5f5f5;display:flex;align-items:center;justify-content:center"><svg class="icon"><use href="icons.svg#icon-worker"></use></svg></div>
                        ${p.name}
                    </div>
                </td>
                <td dir="ltr">+966${p.phone}</td>
                <td>${p.service_type}</td>
                <td>${levelLabel[p.level] || p.level}</td>
                <td><svg class="icon"><use href="icons.svg#icon-star"></use></svg> ${p.rating}</td>
                <td>${p.is_available ? '<span class="badge badge-done">متاح</span>' : '<span class="badge badge-cancel">مشغول</span>'}</td>
                <td>
                    ${p.id_document_path ? `<a href="${p.id_document_path}" target="_blank"><svg class="icon"><use href="icons.svg#icon-id-card"></use></svg> الهوية</a>` : '—'}
                    ${p.certificate_path ? ` &nbsp;<a href="${p.certificate_path}" target="_blank"><svg class="icon"><use href="icons.svg#icon-document"></use></svg> الشهادة</a>` : ''}
                </td>
                <td>
                    <button class="btn-detail" style="background:#10B981;color:#fff;border-color:#10B981">قبول</button>
                    <button class="btn-detail" style="background:#EF4444;color:#fff;border-color:#EF4444;margin-right:4px">رفض</button>
                </td>
            </tr>
        `).join('');
    } catch(e) {}
}

// صفحة العملاء
async function loadClientsPage() {
    try {
        const res  = await fetch(`${API}/users`);
        const data = await res.json();
        if (!data.success) return;

        document.getElementById('allUsersTable').innerHTML = data.users.map(u => `
            <tr>
                <td>#${u.id}</td>
                <td dir="ltr">+966${u.phone}</td>
                <td>٠</td>
                <td style="color:var(--gold)">٠ ر</td>
                <td>${u.verified ? '<svg class="icon"><use href="icons.svg#icon-check"></use></svg> موثق' : '<svg class="icon"><use href="icons.svg#icon-x-circle"></use></svg> غير موثق'}</td>
                <td>${new Date(u.created_at).toLocaleDateString('ar-SA')}</td>
            </tr>
        `).join('');
    } catch(e) {}
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

// صفحة العمولات
async function loadCommissionsPage() {
    try {
        const res  = await fetch(`${API}/reports/commissions`);
        const data = await res.json();
        if (!data.success) return;

        document.getElementById('comm-today').textContent = data.today.toLocaleString() + ' ر';
        document.getElementById('comm-week').textContent  = data.week.toLocaleString()  + ' ر';
        document.getElementById('comm-month').textContent = data.month.toLocaleString() + ' ر';
        document.getElementById('comm-total').textContent = data.total.toLocaleString() + ' ر';

        document.getElementById('commissionsByServiceTable').innerHTML = Object.entries(data.byService).map(([service, s]) => `
            <tr>
                <td>${service}</td>
                <td>${s.count}</td>
                <td>${s.revenue.toLocaleString()} ر</td>
                <td style="color:var(--gold);font-weight:700">${s.commission.toLocaleString()} ر</td>
            </tr>
        `).join('');
    } catch (e) {}
}

// صفحة المدفوعات
async function loadPaymentsPage() {
    try {
        const res  = await fetch(`${API}/reports/payments`);
        const data = await res.json();
        if (!data.success) return;

        const statusBadge = {
            pending:   '<span class="badge badge-pending">انتظار</span>',
            accepted:  '<span class="badge badge-active">مقبول</span>',
            completed: '<span class="badge badge-done">مكتمل</span>',
            cancelled: '<span class="badge badge-cancel">ملغي</span>',
        };

        document.getElementById('paymentsTable').innerHTML = data.payments.map(p => `
            <tr>
                <td><strong>#${p.id}</strong></td>
                <td dir="ltr">+966${p.phone}</td>
                <td>${p.service}</td>
                <td>${p.provider_name || '—'}</td>
                <td>${p.price.toLocaleString()} ر</td>
                <td>${p.discount ? `<span style="color:var(--red)">-${p.discount} ر (${p.coupon_code})</span>` : '—'}</td>
                <td style="color:var(--gold)">${p.commission.toLocaleString()} ر</td>
                <td style="color:var(--green)">${p.net_to_provider.toLocaleString()} ر</td>
                <td>${statusBadge[p.status] || p.status}</td>
                <td>${new Date(p.created_at).toLocaleDateString('ar-SA')}</td>
            </tr>
        `).join('');
    } catch (e) {}
}

// صفحة المدن
let editingCityId = null;

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

// صفحة كوبونات الخصم
let editingCouponId = null;

async function loadCouponsPage() {
    try {
        const res  = await fetch(`${API}/coupons`);
        const data = await res.json();
        if (!data.success) return;

        document.getElementById('allCouponsTable').innerHTML = data.coupons.map(c => {
            const valueLabel = c.discount_type === 'percent' ? `${c.discount_value}%` : `${c.discount_value} ر`;
            const usageLabel = c.usage_limit ? `${c.used_count} / ${c.usage_limit}` : `${c.used_count} / بلا حد`;
            const expiryLabel = c.expires_at ? new Date(c.expires_at).toLocaleDateString('ar-SA') : 'بلا تاريخ';

            return `
                <tr>
                    <td><strong>${c.code}</strong></td>
                    <td>${c.discount_type === 'percent' ? 'نسبة %' : 'مبلغ ثابت'}</td>
                    <td>${valueLabel}</td>
                    <td>${c.max_discount ? c.max_discount + ' ر' : '—'}</td>
                    <td>${usageLabel}</td>
                    <td>${expiryLabel}</td>
                    <td>${c.is_active ? '<span class="badge badge-done">نشط</span>' : '<span class="badge badge-cancel">موقوف</span>'}</td>
                    <td>
                        <button class="btn-detail" onclick='openEditCoupon(${JSON.stringify(c)})'>تعديل</button>
                        <button class="btn-detail" style="color:var(--red);border-color:var(--red)" onclick="deleteCoupon(${c.id})">حذف</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {}
}

function toggleCouponForm() {
    const form   = document.getElementById('couponForm');
    const isOpen = form.style.display === 'block';

    if (isOpen) {
        form.style.display = 'none';
    } else {
        resetCouponForm();
        form.style.display = 'block';
    }
}

function resetCouponForm() {
    editingCouponId = null;
    document.getElementById('couponFormTitle').textContent = 'إضافة كوبون جديد';
    document.getElementById('couponCode').value    = '';
    document.getElementById('couponType').value    = 'percent';
    document.getElementById('couponValue').value   = '';
    document.getElementById('couponMax').value     = '';
    document.getElementById('couponLimit').value   = '';
    document.getElementById('couponExpiry').value  = '';
    document.getElementById('couponActive').checked = true;
}

function openEditCoupon(coupon) {
    editingCouponId = coupon.id;
    document.getElementById('couponFormTitle').textContent = 'تعديل الكوبون';
    document.getElementById('couponCode').value    = coupon.code;
    document.getElementById('couponType').value    = coupon.discount_type;
    document.getElementById('couponValue').value   = coupon.discount_value;
    document.getElementById('couponMax').value     = coupon.max_discount || '';
    document.getElementById('couponLimit').value   = coupon.usage_limit || '';
    document.getElementById('couponExpiry').value  = coupon.expires_at || '';
    document.getElementById('couponActive').checked = !!coupon.is_active;

    const form = document.getElementById('couponForm');
    form.style.display = 'block';
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function submitCoupon() {
    const code        = document.getElementById('couponCode').value.trim();
    const discountType  = document.getElementById('couponType').value;
    const discountValue = parseFloat(document.getElementById('couponValue').value);
    const maxDiscount  = document.getElementById('couponMax').value ? parseFloat(document.getElementById('couponMax').value) : null;
    const usageLimit   = document.getElementById('couponLimit').value ? parseInt(document.getElementById('couponLimit').value, 10) : null;
    const expiresAt    = document.getElementById('couponExpiry').value || null;
    const isActive     = document.getElementById('couponActive').checked;

    if (!code || !discountValue) {
        alert('❌ يرجى تعبئة الكود وقيمة الخصم');
        return;
    }

    try {
        const url    = editingCouponId ? `${API}/coupons/${editingCouponId}` : `${API}/coupons`;
        const method = editingCouponId ? 'PUT' : 'POST';

        const res  = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, discountType, discountValue, maxDiscount, usageLimit, expiresAt, isActive }),
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('couponForm').style.display = 'none';
            loadCouponsPage();
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function deleteCoupon(id) {
    if (!confirm('هل أنت متأكد من حذف هذا الكوبون؟')) return;

    try {
        await fetch(`${API}/coupons/${id}`, { method: 'DELETE' });
        loadCouponsPage();
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// صفحة الخدمات
let editingServiceId = null;

const SERVICE_BADGE_LABELS  = { instant: 'فوري', scheduled: 'مجدول', coming: 'قريباً' };
const SERVICE_ACTION_LABELS = { order: 'طلب عادي', container: 'تدفق الحاوية', panel: 'لوحة قريباً' };

async function loadServicesPage() {
    try {
        const res  = await fetch(`${API}/services`);
        const data = await res.json();
        if (!data.success) return;

        document.getElementById('allServicesTable').innerHTML = data.services.map(s => `
            <tr>
                <td><svg class="icon"><use href="icons.svg#icon-${s.icon}"></use></svg></td>
                <td><strong>${s.name}</strong></td>
                <td>${s.description || '—'}</td>
                <td>${SERVICE_BADGE_LABELS[s.badge_type] || s.badge_type}</td>
                <td>${SERVICE_ACTION_LABELS[s.action_type] || s.action_type}</td>
                <td>${s.min_price ? s.min_price + ' ر' : '—'}</td>
                <td>${s.sort_order}</td>
                <td>${s.is_active ? '<span class="badge badge-done">نشطة</span>' : '<span class="badge badge-cancel">موقوفة</span>'}</td>
                <td>
                    <button class="btn-detail" onclick='openEditService(${JSON.stringify(s)})'>تعديل</button>
                    <button class="btn-detail" style="color:var(--red);border-color:var(--red)" onclick="deleteService(${s.id})">حذف</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {}
}

function toggleServiceForm() {
    const form   = document.getElementById('serviceForm');
    const isOpen = form.style.display === 'block';

    if (isOpen) {
        form.style.display = 'none';
    } else {
        resetServiceForm();
        form.style.display = 'block';
    }
}

function resetServiceForm() {
    editingServiceId = null;
    document.getElementById('serviceFormTitle').textContent = 'إضافة خدمة جديدة';
    document.getElementById('serviceName').value          = '';
    document.getElementById('serviceIcon').value           = '';
    document.getElementById('serviceDescription').value    = '';
    document.getElementById('serviceBadgeType').value      = 'instant';
    document.getElementById('serviceActionType').value     = 'order';
    document.getElementById('serviceMinPrice').value       = '';
    document.getElementById('serviceTimeEstimate').value   = '';
    document.getElementById('serviceSortOrder').value      = '';
    document.getElementById('serviceActive').checked       = true;
}

function openEditService(service) {
    editingServiceId = service.id;
    document.getElementById('serviceFormTitle').textContent = 'تعديل الخدمة';
    document.getElementById('serviceName').value          = service.name;
    document.getElementById('serviceIcon').value           = service.icon;
    document.getElementById('serviceDescription').value    = service.description || '';
    document.getElementById('serviceBadgeType').value      = service.badge_type;
    document.getElementById('serviceActionType').value     = service.action_type;
    document.getElementById('serviceMinPrice').value       = service.min_price || '';
    document.getElementById('serviceTimeEstimate').value   = service.time_estimate || '';
    document.getElementById('serviceSortOrder').value      = service.sort_order;
    document.getElementById('serviceActive').checked       = !!service.is_active;

    const form = document.getElementById('serviceForm');
    form.style.display = 'block';
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function submitService() {
    const name         = document.getElementById('serviceName').value.trim();
    const icon         = document.getElementById('serviceIcon').value.trim();
    const description  = document.getElementById('serviceDescription').value.trim();
    const badgeType    = document.getElementById('serviceBadgeType').value;
    const actionType   = document.getElementById('serviceActionType').value;
    const minPrice     = document.getElementById('serviceMinPrice').value ? parseInt(document.getElementById('serviceMinPrice').value, 10) : null;
    const timeEstimate = document.getElementById('serviceTimeEstimate').value.trim() || null;
    const sortOrder    = document.getElementById('serviceSortOrder').value ? parseInt(document.getElementById('serviceSortOrder').value, 10) : 0;
    const isActive     = document.getElementById('serviceActive').checked;

    if (!name || !icon) {
        alert('❌ يرجى تعبئة اسم الخدمة والأيقونة');
        return;
    }

    try {
        const url    = editingServiceId ? `${API}/services/${editingServiceId}` : `${API}/services`;
        const method = editingServiceId ? 'PUT' : 'POST';

        const res  = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, icon, description, badgeType, actionType, minPrice, timeEstimate, sortOrder, isActive }),
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('serviceForm').style.display = 'none';
            loadServicesPage();
        } else {
            alert(`❌ ${data.message}`);
        }
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

async function deleteService(id) {
    if (!confirm('هل أنت متأكد من حذف هذه الخدمة؟ راح تختفي من الصفحة الرئيسية فوراً.')) return;

    try {
        await fetch(`${API}/services/${id}`, { method: 'DELETE' });
        loadServicesPage();
    } catch (e) {
        alert('❌ خطأ في الاتصال بالسيرفر');
    }
}

// ══ المحادثات ══

const CHAT_SENDER_LABELS = { client: 'العميل', provider: 'المزوّد', admin: 'الإدارة' };

async function loadChatsPage() {
    await fetchConversations();
    renderChatsList();

    if (!chatsListRefreshInterval) {
        chatsListRefreshInterval = setInterval(async () => {
            await fetchConversations();
            renderChatsList();
        }, 30000);
    }
}

async function fetchConversations() {
    try {
        const res  = await fetch(`${API}/chats`);
        const data = await res.json();
        if (data.success) allConversations = data.conversations;
        updateChatsBadge();
    } catch (e) {}
}

function updateChatsBadge() {
    const badge = document.getElementById('chatsBadge');
    if (!badge) return;
    const count = allConversations.filter(c => c.needs_intervention).length;
    badge.textContent   = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
}

function setChatFilter(filter, btn) {
    currentChatFilter = filter;
    document.querySelectorAll('.chat-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderChatsList();
}

function renderChatsList() {
    const container = document.getElementById('chatsListContainer');
    const search = (document.getElementById('chatSearchInput')?.value || '').trim().toLowerCase();

    let list = allConversations;

    if (currentChatFilter === 'active') {
        list = list.filter(c => c.order_status === 'pending' || c.order_status === 'accepted');
    } else if (currentChatFilter === 'completed') {
        list = list.filter(c => c.order_status === 'completed' || c.order_status === 'cancelled');
    } else if (currentChatFilter === 'intervention') {
        list = list.filter(c => c.needs_intervention);
    }

    if (search) {
        list = list.filter(c =>
            String(c.order_id).includes(search) ||
            (c.client_name && c.client_name.toLowerCase().includes(search)) ||
            (c.client_phone && c.client_phone.includes(search))
        );
    }

    if (!list.length) {
        container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:24px;font-size:13px">لا توجد محادثات مطابقة</p>';
        return;
    }

    const statusLabels = {
        pending:   { label: 'انتظار',  class: 'badge-pending' },
        accepted:  { label: 'نشطة',    class: 'badge-active'  },
        completed: { label: 'مكتملة',  class: 'badge-done'    },
        cancelled: { label: 'ملغية',   class: 'badge-cancel'  },
    };

    container.innerHTML = list.map(c => {
        const status = statusLabels[c.order_status] || { label: c.order_status, class: 'badge-active' };
        const clientLabel = c.client_name || `+966${c.client_phone}`;
        const lastSenderLabel = CHAT_SENDER_LABELS[c.last_sender] || c.last_sender;

        return `
            <div class="chat-list-item ${c.needs_intervention ? 'needs-intervention' : ''}">
                <div class="chat-list-main">
                    <div class="chat-list-top">
                        <span>#${c.order_id} — ${c.service}</span>
                        <span class="badge ${status.class}">${status.label}</span>
                    </div>
                    <div class="chat-list-people">${clientLabel} ↔ ${c.provider_name || 'بدون مزوّد'}</div>
                    <div class="chat-list-last">
                        <span class="chat-list-last-text"><strong>${lastSenderLabel}:</strong> ${c.last_message}</span>
                        <span>منذ ${formatAgo(minutesAgo(c.last_message_at))}</span>
                    </div>
                </div>
                <div class="chat-list-actions">
                    ${c.unread_count > 0 ? `<span class="badge badge-cancel">${c.unread_count} غير مقروءة</span>` : ''}
                    <button class="btn-detail" onclick="openChatPanel(${c.order_id})">عرض المحادثة</button>
                    ${c.needs_intervention ? `<button class="btn-detail" style="background:var(--red);color:#fff;border-color:var(--red)" onclick="openChatPanel(${c.order_id})">تدخل الآن</button>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

async function openChatPanel(orderId) {
    currentChatOrderId = orderId;

    const convo = allConversations.find(c => c.order_id === orderId);
    document.getElementById('chatPanelOrderId').textContent = orderId;
    document.getElementById('chatPanelService').textContent = convo ? convo.service : '';
    document.getElementById('chatPanelSub').textContent = convo
        ? `${convo.client_name || '+966' + convo.client_phone} ↔ ${convo.provider_name || 'بدون مزوّد'}`
        : '';

    document.getElementById('chatPanelOverlay').style.display = 'block';

    await refreshChatPanelMessages();
    await fetch(`${API}/chats/${orderId}/read`, { method: 'PUT' });
    await fetchConversations();
    renderChatsList();

    if (!chatPanelRefreshInterval) {
        chatPanelRefreshInterval = setInterval(refreshChatPanelMessages, 10000);
    }
}

async function refreshChatPanelMessages() {
    if (!currentChatOrderId) return;

    try {
        const res  = await fetch(`${API}/chats/${currentChatOrderId}`);
        const data = await res.json();
        if (data.success) renderChatPanelMessages(data.messages);
    } catch (e) {}
}

function renderChatPanelMessages(messages) {
    const container = document.getElementById('chatPanelMessages');

    if (!messages.length) {
        container.innerHTML = '<p style="color:var(--text3);text-align:center;font-size:13px">لا توجد رسائل بعد</p>';
        return;
    }

    const wasAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 30;

    container.innerHTML = messages.map(m => `
        <div class="admin-chat-bubble sender-${m.sender}">
            <div class="bubble-sender">${CHAT_SENDER_LABELS[m.sender] || m.sender}</div>
            <div>${m.message}</div>
            <div class="bubble-time">${new Date(m.created_at.replace(' ', 'T') + 'Z').toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
    `).join('');

    if (wasAtBottom) container.scrollTop = container.scrollHeight;
}

function closeChatPanel() {
    document.getElementById('chatPanelOverlay').style.display = 'none';
    if (chatPanelRefreshInterval) {
        clearInterval(chatPanelRefreshInterval);
        chatPanelRefreshInterval = null;
    }
    currentChatOrderId = null;
}

async function sendAdminChatMessage() {
    const input = document.getElementById('chatPanelInput');
    const message = input.value.trim();

    if (!message || !currentChatOrderId) return;

    try {
        await fetch(`${API}/chats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: currentChatOrderId, sender: 'admin', message }),
        });
        input.value = '';
        await refreshChatPanelMessages();
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
    if (currentComplaintFilter !== 'all') {
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
                        <span>شكوى #${c.id}${c.order_id ? ' — طلب #' + c.order_id : ''}</span>
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

// تحديث حالة الطلب
async function updateStatus(id, status) {
    try {
        await fetch(`${API}/orders/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
    } catch(e) {}
}

// ══ مركز العمليات المباشر ══

let opsOrdersCache     = [];
let opsProvidersCache  = [];

// بدء تشغيل صفحة مركز العمليات + التحديث التلقائي كل 30 ثانية
function startOperationsPage() {
    loadOperationsPage();
    opsRefreshInterval = setInterval(loadOperationsPage, 30000);
}

// حساب عدد الدقائق منذ تاريخ SQLite (مخزّن UTC بدون منطقة زمنية)
function minutesAgo(dateStr) {
    if (!dateStr) return null;
    const then = new Date(dateStr.replace(' ', 'T') + 'Z').getTime();
    return Math.max(0, Math.round((Date.now() - then) / 60000));
}

function formatAgo(minutes) {
    if (minutes === null) return '—';
    if (minutes < 60)   return `${minutes} د`;
    if (minutes < 1440) return `${Math.round(minutes / 60)} س`;
    return `${Math.round(minutes / 1440)} يوم`;
}

// تحديث رقم إحصائي مع وميض أخضر لو تغيّرت القيمة
function flashUpdate(elId, newValue) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (el.textContent !== String(newValue)) {
        el.textContent = newValue;
        el.classList.remove('flash-update');
        void el.offsetWidth;
        el.classList.add('flash-update');
    }
}

async function loadOperationsPage() {
    try {
        const [liveRes, ordersRes, providersRes] = await Promise.all([
            fetch(`${API}/operations/live`),
            fetch(`${API}/orders`),
            fetch(`${API}/providers`),
        ]);

        const live      = await liveRes.json();
        const ordersData    = await ordersRes.json();
        const providersData = await providersRes.json();

        if (!live.success || !ordersData.success || !providersData.success) return;

        const allOrders = ordersData.orders;
        const activeOrders    = allOrders.filter(o => o.status === 'pending' || o.status === 'accepted');
        const availableProviders = providersData.providers.filter(p => p.is_available);

        opsOrdersCache    = activeOrders;
        opsProvidersCache = availableProviders;

        // الإحصائيات اللحظية
        flashUpdate('ops-active-orders',       live.stats.activeOrders);
        flashUpdate('ops-available-providers', live.stats.availableProviders);
        flashUpdate('ops-avg-acceptance',      live.stats.avgAcceptanceMinutes !== null ? `${live.stats.avgAcceptanceMinutes} د` : '—');
        flashUpdate('ops-today-revenue',       live.stats.todayRevenue.toLocaleString() + ' ر');

        renderOpsAlerts(live.alerts);
        renderOpsOrdersTable(activeOrders);
        renderOpsProvidersTable(availableProviders, allOrders);
        renderOpsMap(activeOrders, availableProviders);

    } catch (e) {}
}

// التنبيهات الفورية
function renderOpsAlerts(alerts) {
    const container = document.getElementById('opsAlertsList');

    if (!alerts.length) {
        container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:16px;font-size:13px">لا توجد تنبيهات حالياً</p>';
        return;
    }

    const levelClass = { red: 'alert-red', yellow: 'alert-warn', blue: 'alert-blue' };
    const levelIcon  = { red: 'siren', yellow: 'clock', blue: 'worker' };

    container.innerHTML = alerts.map(a => `
        <div class="alert-item ${levelClass[a.level] || 'alert-blue'}">
            <svg class="icon"><use href="icons.svg#icon-${levelIcon[a.level] || 'warning'}"></use></svg>
            <span>${a.message}</span>
            <button class="alert-action" onclick='handleAlertAction(${JSON.stringify(a)})'>تصرف الآن</button>
        </div>
    `).join('');
}

function handleAlertAction(alertItem) {
    if (alertItem.type === 'order_unassigned') {
        const order = opsOrdersCache.find(o => o.id === alertItem.orderId);
        if (order) openAssignModal(order.id, order.service);
    } else if (alertItem.type === 'provider_review') {
        document.querySelector('.sidebar-item[data-page="providers"]')?.click();
    }
}

// جدول الطلبات المباشرة
function renderOpsOrdersTable(orders) {
    const statusBadge = {
        pending:   '<span class="badge badge-pending">انتظار</span>',
        accepted:  '<span class="badge badge-active">مقبول</span>',
    };

    document.getElementById('opsOrdersTable').innerHTML = orders.map(o => {
        const age = minutesAgo(o.created_at);
        const rowClass = age >= 10 ? 'ops-order-row-red' : (age >= 5 ? 'ops-order-row-yellow' : '');

        return `
            <tr class="${rowClass}">
                <td><strong>#${o.id}</strong></td>
                <td>${o.service}</td>
                <td dir="ltr">+966${o.phone}</td>
                <td>${(o.address || '').substring(0, 25)}${(o.address || '').length > 25 ? '...' : ''}</td>
                <td>${formatAgo(age)}</td>
                <td>${statusBadge[o.status] || o.status}</td>
                <td><button class="btn-detail" onclick="openAssignModal(${o.id}, '${o.service}')">تدخل يدوي</button></td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:24px">لا توجد طلبات نشطة الآن</td></tr>';
}

// المزودون المتاحون الآن
function renderOpsProvidersTable(providers, allOrders) {
    document.getElementById('opsProvidersTable').innerHTML = providers.map(p => {
        const lastOrder = allOrders.find(o => o.provider_id === p.id);
        const activityLabel = lastOrder ? `منذ ${formatAgo(minutesAgo(lastOrder.created_at))}` : 'لا يوجد نشاط بعد';

        return `
            <tr>
                <td>${p.name}</td>
                <td>${p.service_type}</td>
                <td><svg class="icon"><use href="icons.svg#icon-star"></use></svg> ${p.rating}</td>
                <td>${activityLabel}</td>
                <td><a class="btn-detail" href="tel:+966${p.phone}" style="text-decoration:none;display:inline-block">تواصل</a></td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:24px">لا يوجد مزودون متاحون حالياً</td></tr>';
}

// الخريطة المباشرة
function initOpsMap() {
    if (opsMap) return;

    opsMap = L.map('opsMap').setView([24.7136, 46.6753], 11);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
    }).addTo(opsMap);
}

function renderOpsMap(activeOrders, availableProviders) {
    initOpsMap();

    opsMapMarkers.forEach(m => opsMap.removeLayer(m));
    opsMapMarkers = [];

    const redIcon = L.divIcon({
        className: '', html: '<div style="width:14px;height:14px;border-radius:50%;background:#EF4444;border:2px solid #fff;box-shadow:0 0 0 1px #EF4444"></div>',
        iconSize: [14, 14],
    });
    const greenIcon = L.divIcon({
        className: '', html: '<div style="width:14px;height:14px;border-radius:50%;background:#10B981;border:2px solid #fff;box-shadow:0 0 0 1px #10B981"></div>',
        iconSize: [14, 14],
    });

    activeOrders.forEach(o => {
        if (!o.lat || !o.lng) return;
        const age = minutesAgo(o.created_at);
        const marker = L.marker([o.lat, o.lng], { icon: redIcon }).addTo(opsMap)
            .bindPopup(`<strong>طلب #${o.id}</strong><br>${o.service}<br>منذ ${formatAgo(age)}`);
        opsMapMarkers.push(marker);
    });

    availableProviders.forEach(p => {
        if (!p.lat || !p.lng) return;
        const marker = L.marker([p.lat, p.lng], { icon: greenIcon }).addTo(opsMap)
            .bindPopup(`<strong>${p.name}</strong><br>${p.service_type}<br>⭐ ${p.rating}`);
        opsMapMarkers.push(marker);
    });
}

// تعيين مزود يدوياً
function openAssignModal(orderId, service) {
    document.getElementById('assignOrderId').textContent = orderId;

    const matching = opsProvidersCache.filter(p => p.service_type === service);
    const select = document.getElementById('assignProviderSelect');

    select.innerHTML = matching.length
        ? matching.map(p => `<option value="${p.id}">${p.name} — ⭐ ${p.rating}</option>`).join('')
        : '<option value="">لا يوجد مزود متاح لهذه الخدمة</option>';

    select.dataset.orderId = orderId;
    document.getElementById('assignProviderModal').style.display = 'flex';
}

function closeAssignModal() {
    document.getElementById('assignProviderModal').style.display = 'none';
}

async function submitAssignProvider() {
    const select    = document.getElementById('assignProviderSelect');
    const providerId = select.value;
    const orderId    = select.dataset.orderId;

    if (!providerId) {
        alert('❌ لا يوجد مزود متاح لتعيينه');
        return;
    }

    try {
        const res  = await fetch(`${API}/orders/${orderId}/assign-provider`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ providerId }),
        });
        const data = await res.json();

        if (data.success) {
            closeAssignModal();
            loadOperationsPage();
        } else {
            alert(`❌ ${data.message}`);
        }
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

    if (savedRole === 'admin') {
        loadDashboard();
    } else {
        const firstPage = (ROLE_PAGES[savedRole] || [])[0];
        if (firstPage) showPage(firstPage);
    }
}