
import { db } from './supabase.js';

const form = document.getElementById('loginForm');
const googleBtn = document.getElementById('googleBtn');
const registerBtn = document.getElementById('registerBtn');
const message = document.getElementById('message');

let registerMode = false;

function showMessage(text) {
    message.textContent = text;
}

async function redirectUser(user) {
    const { data, error } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (error || !data) {
        showMessage('Profile verification failed.');
        return;
    }

    window.location.href =
        data.role === 'admin' ? 'admin.html' : 'index.html';
}

// GOOGLE LOGIN

googleBtn.addEventListener('click', async () => {
    showMessage('Connecting to Google...');

    const { error } = await db.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + '/index.html'
        }
    });

    if (error) {
        showMessage(error.message);
    }
});
// SWITCH LOGIN / REGISTER

registerBtn.addEventListener('click', (e) => {
    e.preventDefault();

    registerMode = !registerMode;

    if (registerMode) {
        form.innerHTML = `
            <label>Full Name</label>
            <input id="fullName" required placeholder="Your name">

            <label>Email Address</label>
            <input id="email" type="email" required>

            <label>Password</label>
            <input id="password" type="password"
                   minlength="8" required>

            <button class="submit-btn" type="submit">
                CREATE ACCOUNT
            </button>
        `;

        registerBtn.textContent = 'Back to Sign In';

    } else {
        window.location.reload();
    }
});

// LOGIN AND REGISTER

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    showMessage('Please wait...');

    if (registerMode) {

        const fullName =
            document.getElementById('fullName').value;

        const { data, error } = await db.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: fullName }
            }
        });

        if (error) {
            showMessage(error.message);
            return;
        }

        if (data.session) {
            await redirectUser(data.user);
        } else {
            showMessage(
                'Account created! Please verify your email.'
            );
        }

    } else {

        const { data, error } = await db.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            showMessage(error.message);
            return;
        }

        await redirectUser(data.user);
    }
});

// RESTORE SESSION

const { data } = await db.auth.getSession();

if (data.session) {
    await redirectUser(data.session.user);
}
