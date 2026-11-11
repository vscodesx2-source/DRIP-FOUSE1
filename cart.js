
// ==========================================
// DRIP FOUSE - SHOPPING CART SYSTEM
// LUXURY GOLD EDITION
// ==========================================

const CART_KEY = "dripFouseCart";

const cartItems = document.getElementById("cart-items");
const cartCount = document.getElementById("cart-count");
const cartSubtotal = document.getElementById("cart-subtotal");
const cartTotal = document.getElementById("cart-total");
const checkoutButton = document.getElementById("cart-checkout");

const FALLBACK_IMAGE =
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=700";


// ==========================================
// 1. SAFE HTML
// ==========================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}


// ==========================================
// 2. READ CART
// ==========================================

function getCart() {
    try {
        const saved = JSON.parse(
            localStorage.getItem(CART_KEY) || "[]"
        );

        if (!Array.isArray(saved)) return [];

        return saved.filter(item =>
            item &&
            item.id !== undefined &&
            item.name &&
            Number.isFinite(Number(item.price)) &&
            Number(item.price) > 0 &&
            Number.isInteger(Number(item.quantity)) &&
            Number(item.quantity) > 0
        );

    } catch (error) {
        console.error("CART STORAGE ERROR:", error);
        return [];
    }
}


// ==========================================
// 3. SAVE CART
// ==========================================

function saveCart(cart) {
    try {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
        renderCart();
    } catch (error) {
        console.error("CART SAVE ERROR:", error);
        alert("Unable to save your cart. Please check browser storage.");
    }
}


// ==========================================
// 4. FORMAT PRICE
// ==========================================

function formatPrice(price) {
    return Number(price || 0).toFixed(2) + " DT";
}


// ==========================================
// 5. RENDER CART
// ==========================================

function renderCart() {
    if (!cartItems) return;

    const cart = getCart();

    const totalQuantity = cart.reduce(
        (sum, item) => sum + Number(item.quantity),
        0
    );

    const subtotal = cart.reduce(
        (sum, item) =>
            sum + Number(item.price) * Number(item.quantity),
        0
    );

    if (cartCount) {
        cartCount.textContent = `${totalQuantity} ITEMS`;
    }

    const summaryCount = document.getElementById("cart-summary-count");

    if (summaryCount) {
        summaryCount.textContent = String(totalQuantity);
    }

    if (cartSubtotal) {
        cartSubtotal.textContent = formatPrice(subtotal);
    }

    if (cartTotal) {
        cartTotal.textContent = formatPrice(subtotal);
    }

    if (checkoutButton) {
        checkoutButton.disabled = cart.length === 0;
    }

    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="cart-empty">
                <div class="cart-empty-icon">✦</div>
                <h2>YOUR CART IS EMPTY</h2>
                <p>Discover our collection and find your next piece.</p>
                <a href="index.html#products" class="cart-continue">
                    EXPLORE COLLECTION
                </a>
            </div>
        `;
        return;
    }

    cartItems.innerHTML = cart.map(item => {
        const image = escapeHTML(item.image || FALLBACK_IMAGE);
        const name = escapeHTML(item.name);
        const category = escapeHTML(item.category || "COLLECTION");
        const id = escapeHTML(item.id);
        const price = Number(item.price);
        const quantity = Number(item.quantity);

        return `
            <article class="cart-item" data-id="${id}">

                <img
                    src="${image}"
                    alt="${name}"
                    loading="lazy"
                    onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}';"
                >

                <div class="cart-item-info">

                    <span class="cart-item-category">
                        ${category}
                    </span>

                    <h3>${name}</h3>

                    <div class="cart-item-price">
                        ${formatPrice(price)}
                    </div>

                    <div class="cart-quantity">

                        <button
                            type="button"
                            data-action="decrease"
                            data-id="${id}"
                            aria-label="Decrease quantity"
                        >−</button>

                        <span>${quantity}</span>

                        <button
                            type="button"
                            data-action="increase"
                            data-id="${id}"
                            aria-label="Increase quantity"
                        >+</button>

                    </div>

                    <button
                        type="button"
                        class="cart-remove"
                        data-action="remove"
                        data-id="${id}"
                    >
                        REMOVE ITEM
                    </button>

                </div>

                <div class="cart-line-total">
                    ${formatPrice(price * quantity)}
                </div>

            </article>
        `;
    }).join("");
}


// ==========================================
// 6. CART ACTIONS
// ==========================================

if (cartItems) {
    cartItems.addEventListener("click", event => {
        const button = event.target.closest("[data-action]");

        if (!button) return;

        const id = button.dataset.id;
        const action = button.dataset.action;

        const cart = getCart();

        const itemIndex = cart.findIndex(
            item => String(item.id) === String(id)
        );

        if (itemIndex === -1) return;

        if (action === "increase") {
            cart[itemIndex].quantity += 1;
        }

        if (action === "decrease") {
            cart[itemIndex].quantity -= 1;

            if (cart[itemIndex].quantity <= 0) {
                cart.splice(itemIndex, 1);
            }
        }

        if (action === "remove") {
            cart.splice(itemIndex, 1);
        }

        saveCart(cart);
    });
}


// ==========================================
// 7. CHECKOUT CONNECTION
// ==========================================

if (checkoutButton) {
    checkoutButton.addEventListener("click", () => {
        const cart = getCart();

        if (cart.length === 0) return;

        window.location.href = "index.html?checkout=cart";
    });
}


// ==========================================
// 8. MOBILE NAVIGATION
// ==========================================

const mobileMenu = document.getElementById("mobile-menu");
const navLinks = document.querySelector(".nav-links");

if (mobileMenu && navLinks) {

    function closeMobileMenu() {
        navLinks.classList.remove("menu-open");
        mobileMenu.setAttribute("aria-expanded", "false");
        mobileMenu.setAttribute("aria-label", "Open navigation menu");
    }

    mobileMenu.setAttribute("aria-expanded", "false");

    mobileMenu.addEventListener("click", () => {
        const isOpen = navLinks.classList.toggle("menu-open");

        mobileMenu.setAttribute("aria-expanded", String(isOpen));
        mobileMenu.setAttribute(
            "aria-label",
            isOpen ? "Close navigation menu" : "Open navigation menu"
        );
    });

    navLinks.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", closeMobileMenu);
    });

    document.addEventListener("click", event => {
        if (
            !navLinks.contains(event.target) &&
            !mobileMenu.contains(event.target)
        ) {
            closeMobileMenu();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeMobileMenu();
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 850) closeMobileMenu();
    });
}


// ==========================================
// 9. START CART
// ==========================================

renderCart();

console.log("DRIP FOUSE CART SYSTEM INITIALIZED!");
