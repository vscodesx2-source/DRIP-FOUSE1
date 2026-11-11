
import { db } from './supabase.js';

// ==========================================
// DRIP FOUSE - PROFILE SYSTEM
// ==========================================

const avatarPreview = document.getElementById('avatarPreview');
const avatarInput = document.getElementById('avatarInput');
const fullNameInput = document.getElementById('fullName');
const emailInput = document.getElementById('email');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const profileMessage = document.getElementById('profileMessage');
const ordersList = document.getElementById('ordersList');

let currentUser = null;

// Default avatar
const DEFAULT_AVATAR =
    'data:image/svg+xml;charset=UTF-8,' +
    encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <rect width="100%" height="100%" fill="#171717"/>
      <circle cx="100" cy="75" r="35" fill="#d6ad55"/>
      <path d="M35 190c5-45 30-65 65-65s60 20 65 65" fill="#d6ad55"/>
    </svg>
    `);

function showMessage(message, success = false) {
    profileMessage.textContent = message;
    profileMessage.style.color = success ? '#d6ad55' : '#ff7777';
}

function setAvatar(url) {
    avatarPreview.src = url || DEFAULT_AVATAR;
}

avatarPreview.addEventListener('error', () => {
    avatarPreview.src = DEFAULT_AVATAR;
});

// ==========================================
// LOAD PROFILE
// ==========================================

async function loadProfile() {
    const { data: userData, error: userError } =
        await db.auth.getUser();

    if (userError || !userData.user) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = userData.user;

    const { data: profile, error } = await db
        .from('profiles')
        .select('full_name, email, avatar_url')
        .eq('id', currentUser.id)
        .single();

    if (error) {
        showMessage('Could not load your profile.');
        console.error(error);
        return;
    }

    fullNameInput.value = profile.full_name || '';
    emailInput.value = currentUser.email || profile.email || '';

    setAvatar(profile.avatar_url);
}

// ==========================================
// SAVE PROFILE NAME
// ==========================================

saveProfileBtn.addEventListener('click', async () => {
    const newName = fullNameInput.value.trim();

    if (!newName) {
        showMessage('Please enter your full name.');
        return;
    }

    saveProfileBtn.disabled = true;
    showMessage('Saving...');

    const { error } = await db
        .from('profiles')
        .update({ full_name: newName })
        .eq('id', currentUser.id);

    saveProfileBtn.disabled = false;

    if (error) {
        showMessage('Could not save profile. Check your database permissions.');
        console.error(error);
        return;
    }

    showMessage('Profile updated successfully!', true);
});

// ==========================================
// UPLOAD AVATAR
// ==========================================

avatarInput.addEventListener('change', async () => {
    const file = avatarInput.files[0];

    if (!file || !currentUser) return;

    if (!file.type.startsWith('image/')) {
        showMessage('Please select an image file.');
        avatarInput.value = '';
        return;
    }

    if (file.size > 3 * 1024 * 1024) {
        showMessage('Image must be smaller than 3 MB.');
        avatarInput.value = '';
        return;
    }

    const extension = file.name.split('.').pop().toLowerCase();
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];

    if (!allowedExtensions.includes(extension)) {
        showMessage('Use JPG, PNG, or WEBP images only.');
        avatarInput.value = '';
        return;
    }

    showMessage('Uploading photo...');

    const filePath = `${currentUser.id}/avatar.${extension}`;

    const { error: uploadError } = await db.storage
        .from('avatars')
        .upload(filePath, file, {
            upsert: true,
            contentType: file.type
        });

    if (uploadError) {
        showMessage('Photo upload failed. Check storage permissions.');
        console.error(uploadError);
        avatarInput.value = '';
        return;
    }

    const { data: publicData } = db.storage
        .from('avatars')
        .getPublicUrl(filePath);

    const avatarUrl = publicData.publicUrl;

    const { error: updateError } = await db
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', currentUser.id);

    if (updateError) {
        showMessage('Photo uploaded, but profile update failed.');
        console.error(updateError);
        avatarInput.value = '';
        return;
    }

    setAvatar(`${avatarUrl}?t=${Date.now()}`);
    showMessage('Profile photo updated!', true);
    avatarInput.value = '';
});

// ==========================================
// LOAD ORDERS
// ==========================================

async function loadOrders() {
    const { data: orders, error } = await db
        .from('orders')
        .select(`
            id,
            product_name,
            product_price,
            quantity,
            status,
            status_published,
            created_at
        `)
        .eq('user_id', currentUser.id)
        .eq('status_published', true)
        .order('created_at', { ascending: false });

    if (error) {
        ordersList.textContent = 'Could not load your orders.';
        console.error(error);
        return;
    }

    ordersList.replaceChildren();

    if (!orders || orders.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'No published orders yet.';
        ordersList.appendChild(empty);
        return;
    }

    orders.forEach(order => {
        const card = document.createElement('div');
        card.className = 'order-card';

        const name = document.createElement('h3');
        name.textContent = order.product_name || 'Product';

        const details = document.createElement('p');
        details.textContent =
            `Quantity: ${order.quantity || 1} | Price: ${order.product_price ?? '-'} DT`;

        const status = document.createElement('span');
        const safeStatus = ['pending', 'accepted', 'rejected']
            .includes(String(order.status).toLowerCase())
            ? String(order.status).toLowerCase()
            : 'pending';

        status.className = `order-status ${safeStatus}`;
        status.textContent = safeStatus.toUpperCase();

        const date = document.createElement('p');
        date.textContent = order.created_at
            ? new Date(order.created_at).toLocaleDateString()
            : '';

        card.append(name, details, status, date);
        ordersList.appendChild(card);
    });
}


// ==========================================
// NAVIGATION - FIXED VERSION
// ==========================================

const navButtons = document.querySelectorAll('.nav-btn');
const accountSections = document.querySelectorAll('.account-section');

navButtons.forEach(button => {
    button.addEventListener('click', () => {
        const targetId = button.dataset.section;

        // Hide all sections
        accountSections.forEach(section => {
            section.classList.remove('active');
        });

        // Remove active state from all buttons
        navButtons.forEach(nav => {
            nav.classList.remove('active');
        });

        // Show selected section
        const targetSection = document.getElementById(targetId);

        if (targetSection) {
            targetSection.classList.add('active');
            button.classList.add('active');
        } else {
            console.error('Section not found:', targetId);
        }
    });
});

// ==========================================
// SIGN OUT
// ==========================================

async function signOut() {
    const { error } = await db.auth.signOut();

    if (error) {
        console.error(error);
        showMessage('Sign out failed. Please try again.');
        return;
    }

    window.location.href = 'login.html';
}

document.getElementById('logoutBtn')
    .addEventListener('click', signOut);

document.getElementById('settingsLogoutBtn')
    .addEventListener('click', signOut);

// ==========================================
// START
// ==========================================

async function startProfile() {
    await loadProfile();

    if (currentUser) {
        await loadOrders();
    }
}

startProfile();
