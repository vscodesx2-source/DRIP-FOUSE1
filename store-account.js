
import { db } from './supabase.js';

const accountLink = document.getElementById('accountLink');

let dashboardLink = document.getElementById('dashboardLink');

if (!dashboardLink && accountLink) {
    dashboardLink = document.createElement('a');
    dashboardLink.id = 'dashboardLink';
    dashboardLink.href = 'admin.html';
    dashboardLink.textContent = 'DASHBOARD';

    // Use the same styling as the account link
    dashboardLink.className = accountLink.className;

    accountLink.insertAdjacentElement('afterend', dashboardLink);
}

async function updateAccountLink() {
    if (!accountLink) return;

    const { data: { user }, error } = await db.auth.getUser();

    if (error || !user) {
        accountLink.textContent = 'LOGIN';
        accountLink.href = 'login.html';

        if (dashboardLink) {
            dashboardLink.style.display = 'none';
        }

        return;
    }

    accountLink.textContent = 'MY ACCOUNT';
    accountLink.href = 'profile.html';

    const { data: profile, error: profileError } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    if (dashboardLink) {
        dashboardLink.style.display =
            !profileError && profile?.role === 'admin'
                ? ''
                : 'none';
    }
}

updateAccountLink();

db.auth.onAuthStateChange(() => {
    updateAccountLink();
});
