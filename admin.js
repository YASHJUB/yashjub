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

    if (page === 'orders')      loadOrdersPage();
    if (page === 'providers')   loadProvidersPage();
    if (page === 'clients')     loadClientsPage();
    if (page === 'employees')   loadEmployeesPage();
    if (page === 'commissions') loadCommissionsPage();
    if (page === 'payments')    loadPaymentsPage();
    if (page === 'cities')      loadCitiesPage();
    if (page === 'coupons')     loadCouponsPage();
    if (page === 'services')    loadServicesPage();
    if (page === 'chats')       loadChatsPage();
    if (page === 'operations')  startOperationsPage();
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