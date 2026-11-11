
import { db } from './supabase.js';

// ==========================================
// DRIP FOUSE - PREMIUM COMMAND CENTER
// LUXURY GOLD ORDER MANAGEMENT
// ==========================================

const $ = (id) => document.getElementById(id);

let allOrders = [];
let allProducts = [];
let revenueChart = null;
let ordersChart = null;

const STORAGE_BUCKET = 'products';

// ==========================================
// ORDER STATUS SYSTEM
// ==========================================

const ORDER_STATUSES = {
    pending: 'Pending',
    accepted: 'Accepted',
    processing: 'Processing',
    packaging: 'Packaging',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    declined: 'Declined'
};

const STATUS_TRANSITIONS = {
    pending: ['accepted', 'declined'],
    accepted: ['processing'],
    processing: ['packaging'],
    packaging: ['out_for_delivery'],
    out_for_delivery: ['delivered']
};

function normalizeOrderStatus(status) {
    const value = String(status || 'pending')
        .toLowerCase()
        .trim()
        .replaceAll(' ', '_');

    return value === 'rejected' ? 'declined' : value;
}

// ==========================================
// SECURITY
// ==========================================

async function verifyAdmin() {
    const {
        data: { user },
        error
    } = await db.auth.getUser();

    if (error || !user) {
        window.location.replace('login.html');
        return null;
    }

    const { data: profile, error: profileError } = await db
        .from('profiles')
        .select('full_name, email, role')
        .eq('id', user.id)
        .single();

    if (
        profileError ||
        !profile ||
        String(profile.role).toLowerCase() !== 'admin'
    ) {
        console.error('Admin verification failed:', profileError);

        alert('Access denied. Administrator permission required.');
        window.location.replace('index.html');

        return null;
    }

    if ($('adminName')) {
        $('adminName').textContent =
            profile.full_name || 'Administrator';
    }

    if ($('adminAvatar')) {
        $('adminAvatar').textContent =
            (profile.full_name || 'A').charAt(0).toUpperCase();
    }

    if ($('settingsAdminEmail')) {
        $('settingsAdminEmail').textContent =
            profile.email || user.email || 'Not available';
    }

    console.log('ADMIN SESSION VERIFIED:', user.id);

    return user;
}

// ==========================================
// HELPERS
// ==========================================

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

function formatPrice(value) {
    return `${Number(value || 0).toLocaleString('en-US', {
        maximumFractionDigits: 2
    })} DT`;
}

function formatDate(value) {
    if (!value) return '—';

    return new Date(value).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function getStatus(status) {
    const value = normalizeOrderStatus(status);
    const label = ORDER_STATUSES[value] || value;

    const cssClass = value === 'declined'
        ? 'rejected'
        : value;

    return `
        <span class="status ${escapeHTML(cssClass)}">
            ${escapeHTML(label)}
        </span>
    `;
}

function showTableError(elementId, colspan, message) {
    const element = $(elementId);
    if (!element) return;

    element.innerHTML = `
        <tr>
            <td colspan="${colspan}" class="empty-state">
                ${escapeHTML(message)}
            </td>
        </tr>
    `;
}

// ==========================================
// ORDERS - LOAD
// ==========================================

async function loadOrders() {
    const { data, error } = await db
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Orders loading error:', error);

        showTableError(
            'ordersTableBody',
            7,
            'Could not load orders. Check admin permissions.'
        );

        showTableError(
            'recentOrdersBody',
            5,
            'Could not load recent orders.'
        );

        return;
    }

    allOrders = data || [];

    renderOrders();
    renderRecentOrders();
    updateStatistics();
    updateCharts();
}

// ==========================================
// ORDER GROUPS
// ==========================================

function getOrderGroupKey(order) {
    return order.order_group_id
        ? `group_${order.order_group_id}`
        : `single_${order.id}`;
}

function groupOrders(orders) {
    const groups = new Map();

    orders.forEach(order => {
        const key = getOrderGroupKey(order);

        if (!groups.has(key)) {
            groups.set(key, {
                key,
                order_group_id: order.order_group_id || null,
                id: order.id,
                user_id: order.user_id,
                first_name: order.first_name,
                last_name: order.last_name,
                email: order.email,
                phone: order.phone,
                address: order.address,
                payment_method: order.payment_method,
                status: normalizeOrderStatus(order.status),
                status_published: order.status_published,
                created_at: order.created_at,
                items: [],
                total: 0
            });
        }

        const group = groups.get(key);

        group.items.push(order);

        group.total +=
            Number(order.product_price || 0) *
            Number(order.quantity || 1);
    });

    return Array.from(groups.values());
}

// ==========================================
// ORDER ACTION BUTTONS
// ==========================================

function renderOrderActions(order) {
    const status = normalizeOrderStatus(order.status);
    const nextStatuses = STATUS_TRANSITIONS[status] || [];

    if (!nextStatuses.length) {
        return `
            <span class="muted-text">
                ${status === 'declined' || status === 'delivered'
                    ? 'COMPLETED'
                    : 'NO ACTION'}
            </span>
        `;
    }

    return nextStatuses.map(nextStatus => {
        const isDecline = nextStatus === 'declined';

        const label = {
            accepted: 'ACCEPT ORDER',
            declined: 'DECLINE',
            processing: 'START PROCESSING',
            packaging: 'START PACKAGING',
            out_for_delivery: 'OUT FOR DELIVERY',
            delivered: 'MARK DELIVERED'
        }[nextStatus];

        return `
            <button
                type="button"
                class="action-btn ${isDecline ? 'reject-btn' : 'accept-btn'}"
                data-order-action="${nextStatus}"
                data-order-key="${escapeHTML(order.key)}"
            >
                ${label}
            </button>
        `;
    }).join('');
}

// ==========================================
// ORDERS - RENDER
// ==========================================

function renderOrders() {
    const body = $('ordersTableBody');
    if (!body) return;

    const search = ($('orderSearch')?.value || '')
        .trim()
        .toLowerCase();

    const filter = $('orderFilter')?.value || 'all';

    const grouped = groupOrders(allOrders);

    const filtered = grouped.filter(order => {
        const status = normalizeOrderStatus(order.status);

        const customerName =
            `${order.first_name || ''} ${order.last_name || ''}`;

        const productNames = order.items
            .map(item => item.product_name)
            .join(' ');

        const matchesSearch = [
            order.id,
            order.order_group_id,
            customerName,
            order.email,
            order.phone,
            order.address,
            order.user_id,
            order.payment_method,
            productNames
        ].some(value =>
            String(value || '').toLowerCase().includes(search)
        );

        const matchesFilter =
            filter === 'all' ||
            status === normalizeOrderStatus(filter);

        return matchesSearch && matchesFilter;
    });

    if (!filtered.length) {
        showTableError('ordersTableBody', 7, 'No orders found.');
        return;
    }

    body.innerHTML = filtered.map(order => {
        const customerName =
            `${order.first_name || ''} ${order.last_name || ''}`.trim()
            || 'Customer';

        const productsHTML = order.items.map(item => `
            <div class="order-product-line">
                <strong>${escapeHTML(item.product_name || 'Product')}</strong>
                <span>
                    ${Number(item.quantity || 1)} ×
                    ${formatPrice(item.product_price)}
                </span>
            </div>
        `).join('');

        return `
            <tr>
                <td>
                    <strong>
                        #${escapeHTML(String(order.id).slice(0, 8))}
                    </strong>
                    <br>
                    <small>${formatDate(order.created_at)}</small>
                </td>

                <td>
                    <strong>${escapeHTML(customerName)}</strong>
                    <br>
                    <small>${escapeHTML(order.email || '—')}</small>
                    <br>
                    <small>${escapeHTML(order.phone || '—')}</small>
                    <br>
                    <small>${escapeHTML(order.address || '—')}</small>
                </td>

                <td>${productsHTML}</td>

                <td>
                    <strong>${formatPrice(order.total)}</strong>
                </td>

                <td>
                    ${escapeHTML(order.payment_method || '—')}
                </td>

                <td>${getStatus(order.status)}</td>

                <td>
                    <div class="order-admin-actions">
                        ${renderOrderActions(order)}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ==========================================
// RECENT ORDERS
// ==========================================

function renderRecentOrders() {
    const body = $('recentOrdersBody');
    if (!body) return;

    const recent = groupOrders(allOrders).slice(0, 6);

    if (!recent.length) {
        showTableError('recentOrdersBody', 5, 'No orders yet.');
        return;
    }

    body.innerHTML = recent.map(order => {
        const customerName =
            `${order.first_name || ''} ${order.last_name || ''}`.trim()
            || 'Customer';

        return `
            <tr>
                <td>
                    #${escapeHTML(String(order.id).slice(0, 8))}
                </td>

                <td>${escapeHTML(customerName)}</td>

                <td>${order.items.length} item(s)</td>

                <td>${formatPrice(order.total)}</td>

                <td>${getStatus(order.status)}</td>
            </tr>
        `;
    }).join('');
}

// ==========================================
// UPDATE ORDER STATUS - FIXED + DEBUG
// ==========================================

async function updateOrderStatus(orderKey, newStatus) {
    const grouped = groupOrders(allOrders);

    const order = grouped.find(
        item => item.key === orderKey
    );

    if (!order) {
        alert('Order not found.');
        return;
    }

    const currentStatus = normalizeOrderStatus(order.status);

    const allowedTransitions =
        STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowedTransitions.includes(newStatus)) {
        alert('This status transition is not allowed.');
        return;
    }

    const confirmation = confirm(
        `Change order status to ${ORDER_STATUSES[newStatus]}?`
    );

    if (!confirmation) return;

    // Disable only the clicked order's buttons.
    const buttons = Array.from(
        document.querySelectorAll('[data-order-key]')
    ).filter(button => button.dataset.orderKey === orderKey);

    buttons.forEach(button => {
        button.disabled = true;
    });

    try {
        // 1. Confirm the real logged-in user.
        const {
            data: userData,
            error: userError
        } = await db.auth.getUser();

        if (userError) throw userError;

        const user = userData?.user;

        if (!user) {
            throw new Error('No authenticated user session.');
        }

        console.log('ORDER UPDATE - USER ID:', user.id);

        // 2. Check admin permission using the active session.
        const {
            data: adminAccess,
            error: adminError
        } = await db.rpc('is_admin');

        if (adminError) {
            throw adminError;
        }

        console.log('ORDER UPDATE - ADMIN ACCESS:', adminAccess);

        if (adminAccess !== true) {
            throw new Error(
                'is_admin() returned false for the current session. Check the profile role and active account.'
            );
        }

        // 3. Prepare the update.
        const updateData = {
            status: newStatus,
            status_published: true,
            reviewed_at: new Date().toISOString()
        };

        let query = db
            .from('orders')
            .update(updateData);

        // 4. Update every row in a grouped cart order.
        if (order.order_group_id) {
            query = query.eq(
                'order_group_id',
                order.order_group_id
            );
        } else {
            // Older orders without a group ID.
            query = query.eq('id', order.id);
        }

        // 5. Return updated row IDs.
        const {
            data,
            error
        } = await query.select('id');

        if (error) {
            console.error('SUPABASE ORDER UPDATE ERROR:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
            });

            throw error;
        }

        if (!data || data.length === 0) {
            throw new Error(
                'Supabase updated zero rows. The order may not match the filter, or RLS may be hiding the rows.'
            );
        }

        console.log('ORDER UPDATE SUCCESS:', {
            orderKey,
            newStatus,
            updatedRows: data.length,
            updatedIDs: data
        });

        alert(
            `Order successfully updated to ${ORDER_STATUSES[newStatus]}.`
        );

        // 6. Reload fresh orders.
        await loadOrders();

    } catch (error) {
        console.error('FULL ORDER UPDATE ERROR:', error);

        const message = [
            'Could not update order.',
            '',
            `Message: ${error.message || 'Unknown error'}`,
            `Code: ${error.code || 'N/A'}`,
            `Details: ${error.details || 'N/A'}`,
            `Hint: ${error.hint || 'N/A'}`
        ].join('\n');

        alert(message);

        buttons.forEach(button => {
            button.disabled = false;
        });
    }
}

// ==========================================
// ORDER EVENTS
// ==========================================

$('ordersTableBody')?.addEventListener('click', event => {
    const button = event.target.closest(
        '[data-order-action][data-order-key]'
    );

    if (!button) return;

    updateOrderStatus(
        button.dataset.orderKey,
        button.dataset.orderAction
    );
});

$('orderSearch')?.addEventListener('input', renderOrders);
$('orderFilter')?.addEventListener('change', renderOrders);

// ==========================================
// STATISTICS
// ==========================================

function updateStatistics() {
    const grouped = groupOrders(allOrders);

    const totalOrders = grouped.length;

    const pending = grouped.filter(order =>
        normalizeOrderStatus(order.status) === 'pending'
    ).length;

    const revenueStatuses = [
        'accepted',
        'processing',
        'packaging',
        'out_for_delivery',
        'delivered'
    ];

    const revenue = grouped.reduce((sum, order) => {
        if (!revenueStatuses.includes(
            normalizeOrderStatus(order.status)
        )) {
            return sum;
        }

        return sum + order.total;
    }, 0);

    if ($('totalOrders')) {
        $('totalOrders').textContent = totalOrders;
    }

    if ($('pendingOrders')) {
        $('pendingOrders').textContent = pending;
    }

    if ($('pendingBadge')) {
        $('pendingBadge').textContent = pending;
    }

    if ($('totalRevenue')) {
        $('totalRevenue').textContent = formatPrice(revenue);
    }
}

// ==========================================
// CHARTS
// ==========================================

function updateCharts() {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js is not available.');
        return;
    }

    const grouped = groupOrders(allOrders);

    const accepted = grouped.filter(order =>
        [
            'accepted',
            'processing',
            'packaging',
            'out_for_delivery',
            'delivered'
        ].includes(normalizeOrderStatus(order.status))
    );

    const declined = grouped.filter(order =>
        normalizeOrderStatus(order.status) === 'declined'
    );

    const pending = grouped.filter(order =>
        normalizeOrderStatus(order.status) === 'pending'
    );

    const months = [];

    for (let i = 5; i >= 0; i--) {
        const date = new Date();

        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        date.setMonth(date.getMonth() - i);

        months.push({
            key: `${date.getFullYear()}-${date.getMonth()}`,
            label: date.toLocaleDateString('en-US', {
                month: 'short'
            }),
            revenue: 0
        });
    }

    accepted.forEach(order => {
        const date = new Date(order.created_at);

        const key =
            `${date.getFullYear()}-${date.getMonth()}`;

        const month = months.find(item => item.key === key);

        if (month) {
            month.revenue += order.total;
        }
    });

    const revenueCanvas = $('revenueChart');

    if (revenueCanvas) {
        if (revenueChart) revenueChart.destroy();

        revenueChart = new Chart(revenueCanvas, {
            type: 'line',

            data: {
                labels: months.map(item => item.label),

                datasets: [{
                    label: 'Revenue (DT)',
                    data: months.map(item => item.revenue),
                    borderColor: '#d6ad55',
                    backgroundColor: 'rgba(214,173,85,0.12)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#f0d38d'
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        display: false
                    }
                },

                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#888'
                        }
                    },

                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255,255,255,0.06)'
                        },
                        ticks: {
                            color: '#888'
                        }
                    }
                }
            }
        });
    }

    const ordersCanvas = $('ordersChart');

    if (ordersCanvas) {
        if (ordersChart) ordersChart.destroy();

        ordersChart = new Chart(ordersCanvas, {
            type: 'doughnut',

            data: {
                labels: [
                    'Pending',
                    'Accepted',
                    'Declined'
                ],

                datasets: [{
                    data: [
                        pending.length,
                        accepted.length,
                        declined.length
                    ],

                    backgroundColor: [
                        '#e9b45f',
                        '#55c995',
                        '#e16d6d'
                    ],

                    borderWidth: 0,
                    hoverOffset: 7
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',

                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
}

// ==========================================
// CUSTOMERS
// ==========================================

async function loadCustomers() {
    const { data, error } = await db
        .from('profiles')
        .select('full_name, email, created_at')
        .eq('role', 'customer')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Customers loading error:', error);

        showTableError(
            'customersTableBody',
            3,
            'Could not load customers.'
        );

        return;
    }

    const customers = data || [];

    if ($('totalCustomers')) {
        $('totalCustomers').textContent = customers.length;
    }

    if (!customers.length) {
        showTableError(
            'customersTableBody',
            3,
            'No customers found.'
        );

        return;
    }

    if ($('customersTableBody')) {
        $('customersTableBody').innerHTML =
            customers.map(customer => `
                <tr>
                    <td>
                        ${escapeHTML(customer.full_name || 'Customer')}
                    </td>

                    <td>
                        ${escapeHTML(customer.email || '—')}
                    </td>

                    <td>
                        ${formatDate(customer.created_at)}
                    </td>
                </tr>
            `).join('');
    }
}

// ==========================================
// PRODUCT IMAGE HELPERS
// ==========================================

function getProductImageUrl(path) {
    if (!path) return '';

    if (/^https?:\/\//i.test(path)) {
        return path;
    }

    const { data } = db.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(path);

    return data?.publicUrl || '';
}

function safeFileName(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9.-]/g, '-')
        .replace(/-+/g, '-');
}

async function uploadProductImage(file) {
    if (!file) return null;

    if (!file.type.startsWith('image/')) {
        throw new Error('Please select a valid image.');
    }

    if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image must be smaller than 5 MB.');
    }

    const filePath =
        `${crypto.randomUUID()}-${safeFileName(file.name)}`;

    const { error } = await db.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (error) throw error;

    return filePath;
}

// ==========================================
// LOAD PRODUCTS
// ==========================================

async function loadProducts() {
    const grid = $('productsGrid');

    if (grid) {
        grid.innerHTML = `
            <div class="inventory-loading">
                Loading products...
            </div>
        `;
    }

    const { data, error } = await db
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Products loading error:', error);

        if (grid) {
            grid.innerHTML = `
                <div class="inventory-empty">
                    <h3>Could Not Load Products</h3>
                    <p>Check Supabase permissions.</p>
                </div>
            `;
        }

        return;
    }

    allProducts = data || [];

    renderProducts();
}

// ==========================================
// RENDER PRODUCT CARDS
// ==========================================

function renderProducts() {
    const grid = $('productsGrid');
    if (!grid) return;

    const search = ($('productSearch')?.value || '')
        .trim()
        .toLowerCase();

    const filtered = allProducts.filter(product => {
        return [
            product.name,
            product.category,
            product.description
        ].some(value =>
            String(value || '').toLowerCase().includes(search)
        );
    });

    const count = $('adminProductCount');

    if (count) {
        count.textContent = `${filtered.length} PRODUCTS`;
    }

    if (!filtered.length) {
        grid.innerHTML = `
            <div class="inventory-empty">
                <span>◇</span>
                <h3>No Products Found</h3>
                <p>Add a product or try another search.</p>
            </div>
        `;

        return;
    }

    grid.innerHTML = filtered.map(product => {
        const imageUrl = getProductImageUrl(product.image_path);
        const published = Boolean(product.published);
        const stock = Number(product.stock || 0);

        return `
            <article class="admin-product-card">

                <div class="admin-product-image">

                    ${
                        imageUrl
                        ? `
                            <img
                                src="${escapeHTML(imageUrl)}"
                                alt="${escapeHTML(product.name)}"
                                loading="lazy"
                            >
                        `
                        : `
                            <div class="product-no-image">
                                <span>DF</span>
                                <small>NO IMAGE</small>
                            </div>
                        `
                    }

                    <span class="product-visibility ${
                        published ? 'is-published' : 'is-hidden'
                    }">
                        ${published ? 'PUBLISHED' : 'HIDDEN'}
                    </span>

                </div>

                <div class="admin-product-content">

                    <span class="admin-product-category">
                        ${escapeHTML(product.category || 'Uncategorized')}
                    </span>

                    <h3>
                        ${escapeHTML(product.name || 'Unnamed Product')}
                    </h3>

                    <p class="admin-product-description">
                        ${escapeHTML(product.description || 'No description available.')}
                    </p>

                    <div class="admin-product-price">
                        ${formatPrice(product.price)}
                    </div>

                    <div class="admin-product-meta">
                        <span>STOCK</span>

                        <strong class="${
                            stock === 0
                                ? 'stock-empty'
                                : stock <= 5
                                    ? 'stock-low'
                                    : ''
                        }">
                            ${stock} units
                        </strong>
                    </div>

                    <div class="admin-product-actions">

                        <button
                            type="button"
                            class="action-btn edit-product-btn"
                            data-product-action="edit"
                            data-id="${escapeHTML(product.id)}"
                        >
                            EDIT
                        </button>

                        <button
                            type="button"
                            class="action-btn reject-btn"
                            data-product-action="delete"
                            data-id="${escapeHTML(product.id)}"
                        >
                            DELETE
                        </button>

                    </div>

                </div>

            </article>
        `;
    }).join('');
}

// ==========================================
// PRODUCT FORM
// ==========================================

function openProductForm(product = null) {
    const panel = $('productFormPanel');
    const form = $('productForm');

    if (!panel || !form) return;

    form.reset();

    $('productId').value = '';
    $('productMessage').textContent = '';

    if (product) {
        $('productId').value = product.id;
        $('productName').value = product.name || '';
        $('productCategory').value = product.category || '';
        $('productPrice').value = product.price ?? '';
        $('productStock').value = product.stock ?? 0;
        $('productDescription').value = product.description || '';
        $('productPublished').checked = Boolean(product.published);

        $('saveProductBtn').textContent = 'UPDATE PRODUCT';
        $('productFormTitle').textContent = 'Edit Product';
    } else {
        $('saveProductBtn').textContent = 'SAVE PRODUCT';
        $('productFormTitle').textContent = 'Add New Product';
    }

    panel.hidden = false;
    panel.style.display = 'block';

    panel.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

function closeProductForm() {
    const panel = $('productFormPanel');

    if (panel) {
        panel.hidden = true;
        panel.style.display = 'none';
    }

    $('productForm')?.reset();

    if ($('productMessage')) {
        $('productMessage').textContent = '';
    }

    if ($('productId')) {
        $('productId').value = '';
    }
}

// ==========================================
// SAVE PRODUCT
// ==========================================

async function saveProduct(event) {
    event.preventDefault();

    const saveButton = $('saveProductBtn');
    const message = $('productMessage');

    const productId = $('productId').value;

    const name = $('productName').value.trim();
    const category = $('productCategory').value;
    const price = Number($('productPrice').value);
    const stock = Number($('productStock').value);
    const description = $('productDescription').value.trim();
    const published = $('productPublished').checked;
    const imageFile = $('productImage').files[0];

    if (!name || !category || !Number.isFinite(price) || price < 0) {
        message.textContent = 'Please complete the required fields.';
        return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
        message.textContent = 'Stock must be a whole number of 0 or more.';
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = 'SAVING...';
    message.textContent = '';

    try {
        const existingProduct = allProducts.find(
            product => String(product.id) === String(productId)
        );

        let imagePath = existingProduct?.image_path || null;

        if (imageFile) {
            imagePath = await uploadProductImage(imageFile);
        }

        const productData = {
            name,
            category,
            price,
            stock,
            description,
            published,
            image_path: imagePath,
            updated_at: new Date().toISOString()
        };

        let result;

        if (productId) {
            result = await db
                .from('products')
                .update(productData)
                .eq('id', productId);
        } else {
            result = await db
                .from('products')
                .insert(productData);
        }

        if (result.error) throw result.error;

        message.textContent = 'Product saved successfully!';

        await loadProducts();

        setTimeout(closeProductForm, 700);

    } catch (error) {
        console.error('Product save error:', error);

        message.textContent =
            error.message || 'Could not save product.';

    } finally {
        saveButton.disabled = false;

        saveButton.textContent = productId
            ? 'UPDATE PRODUCT'
            : 'SAVE PRODUCT';
    }
}

// ==========================================
// EDIT PRODUCT
// ==========================================

function editProduct(productId) {
    const product = allProducts.find(
        item => String(item.id) === String(productId)
    );

    if (!product) {
        alert('Product not found.');
        return;
    }

    openProductForm(product);
}

// ==========================================
// DELETE PRODUCT
// ==========================================

async function deleteProduct(productId) {
    const product = allProducts.find(
        item => String(item.id) === String(productId)
    );

    if (!product) return;

    if (!confirm(`Delete "${product.name}" permanently?`)) {
        return;
    }

    const { error } = await db
        .from('products')
        .delete()
        .eq('id', productId);

    if (error) {
        console.error('Product delete error:', error);

        alert(
            'Could not delete product. Check admin permissions.'
        );

        return;
    }

    if (product.image_path) {
        const { error: storageError } = await db.storage
            .from(STORAGE_BUCKET)
            .remove([product.image_path]);

        if (storageError) {
            console.warn('Image cleanup failed:', storageError);
        }
    }

    await loadProducts();

    alert('Product deleted successfully.');
}

// ==========================================
// PRODUCT EVENT LISTENERS
// ==========================================

$('addProductBtn')?.addEventListener('click', () => {
    openProductForm();
});

$('cancelProductBtn')?.addEventListener('click', closeProductForm);

$('productForm')?.addEventListener('submit', saveProduct);

$('productSearch')?.addEventListener('input', renderProducts);

$('productsGrid')?.addEventListener('click', event => {
    const button = event.target.closest(
        '[data-product-action][data-id]'
    );

    if (!button) return;

    const productId = button.dataset.id;
    const action = button.dataset.productAction;

    if (action === 'edit') {
        editProduct(productId);
    }

    if (action === 'delete') {
        deleteProduct(productId);
    }
});

// ==========================================
// SIDEBAR NAVIGATION
// ==========================================

document.querySelectorAll('.nav-item[data-section]').forEach(button => {
    button.addEventListener('click', () => {
        const sectionId = button.dataset.section;

        document.querySelectorAll('.page-section').forEach(section => {
            section.classList.remove('active');
        });

        document.querySelectorAll('.nav-item[data-section]').forEach(nav => {
            nav.classList.remove('active');
        });

        $(sectionId)?.classList.add('active');
        button.classList.add('active');

        if ($('pageTitle')) {
            $('pageTitle').textContent = button.textContent.trim();
        }

        $('sidebar')?.classList.remove('open');

        if (sectionId === 'orders') {
            loadOrders();
        }
    });
});

// ==========================================
// VIEW ALL ORDERS
// ==========================================

document.querySelectorAll('[data-go]').forEach(button => {
    button.addEventListener('click', () => {
        const target = button.dataset.go;

        document.querySelectorAll('.page-section').forEach(section => {
            section.classList.remove('active');
        });

        document.querySelectorAll('.nav-item[data-section]').forEach(nav => {
            nav.classList.remove('active');
        });

        $(target)?.classList.add('active');

        document.querySelector(
            `.nav-item[data-section="${target}"]`
        )?.classList.add('active');

        if ($('pageTitle')) {
            $('pageTitle').textContent = 'Orders';
        }

        if (target === 'orders') {
            loadOrders();
        }
    });
});

// ==========================================
// MOBILE MENU
// ==========================================

$('menuToggle')?.addEventListener('click', () => {
    $('sidebar')?.classList.toggle('open');
});

// ==========================================
// SIGN OUT
// ==========================================

$('logoutBtn')?.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to sign out?')) return;

    const { error } = await db.auth.signOut();

    if (error) {
        alert(error.message);
        return;
    }

    window.location.replace('login.html');
});

// ==========================================
// INITIALIZE DASHBOARD
// ==========================================

async function initializeDashboard() {
    try {
        const user = await verifyAdmin();

        if (!user) return;

        await Promise.all([
            loadOrders(),
            loadCustomers(),
            loadProducts()
        ]);

    } catch (error) {
        console.error('Dashboard initialization error:', error);

        alert(
            'Dashboard could not initialize. Check the browser console.'
        );
    }
}

initializeDashboard();
