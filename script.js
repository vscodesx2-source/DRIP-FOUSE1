
 // ==========================================
 // DRIP FOUSE - COMPLETE STORE SYSTEM
 // LUXURY GOLD EDITION
 // STORE + CART + MULTI-PRODUCT CHECKOUT
 // ==========================================

import { db } from "./supabase.js";

const productGrid = document.getElementById("product-grid");
const searchInput = document.getElementById("search-input");
const productCount = document.getElementById("product-count");

const CART_KEY = "dripFouseCart";
const STORAGE_BUCKET = "products";

const FALLBACK_IMAGE =
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=700";

let allProducts = [];
let activeCategory = "all";
let checkoutOpening = false;


// ==========================================
// 1. CINEMATIC INTRO
// ==========================================

document.body.classList.add("intro-active");

window.addEventListener("load", () => {
    const opening = document.getElementById("opening-screen");
    const website = document.getElementById("website");

    if (!opening || !website) return;

    setTimeout(() => {
        opening.classList.add("is-hidden");
        website.classList.add("website-visible");

        document.body.classList.remove("intro-active");

        setTimeout(() => opening.remove(), 1400);
    }, 5000);
});


// ==========================================
// 2. MOBILE NAVIGATION
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
    mobileMenu.setAttribute("aria-label", "Open navigation menu");

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

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeMobileMenu();
    });

    document.addEventListener("click", event => {
        if (
            !navLinks.contains(event.target) &&
            !mobileMenu.contains(event.target)
        ) {
            closeMobileMenu();
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 850) closeMobileMenu();
    });
}


// ==========================================
// 3. SAFE HTML
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
// 4. FORMAT PRICE
// ==========================================

function formatPrice(price) {
    return Number(price || 0).toFixed(2) + " DT";
}


// ==========================================
// 5. PRODUCT IMAGE
// ==========================================

function getProductImage(product) {
    const imagePath = product.image_path;

    if (!imagePath) return FALLBACK_IMAGE;

    if (/^https?:\/\//i.test(imagePath)) {
        return imagePath;
    }

    const { data, error } = db.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(imagePath);

    if (error || !data?.publicUrl) {
        console.error("PRODUCT IMAGE ERROR:", error);
        return FALLBACK_IMAGE;
    }

    return data.publicUrl;
}


// ==========================================
// 6. CART STORAGE
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


function saveCart(cart) {
    try {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
        updateCartNavigation();
    } catch (error) {
        console.error("CART SAVE ERROR:", error);
        alert("Unable to save your cart. Please check browser storage.");
    }
}


function updateCartNavigation() {
    const cart = getCart();

    const quantity = cart.reduce(
        (sum, item) => sum + Number(item.quantity),
        0
    );

    const cartLink = document.querySelector(".nav-cart span");

    if (cartLink) {
        cartLink.textContent = quantity > 0 ? String(quantity) : "✦";
    }
}


// ==========================================
// 7. ADD PRODUCT TO CART
// ==========================================

function addToCart(product) {
    const price = Number(product.price);

    if (!Number.isFinite(price) || price <= 0) {
        alert("This product has an invalid price.");
        return;
    }

    if (
        product.stock !== null &&
        product.stock !== undefined &&
        Number(product.stock) <= 0
    ) {
        alert("This product is currently out of stock.");
        return;
    }

    const cart = getCart();

    const existing = cart.find(
        item => String(item.id) === String(product.id)
    );

    if (existing) {
        const nextQuantity = Number(existing.quantity) + 1;

        if (
            product.stock !== null &&
            product.stock !== undefined &&
            nextQuantity > Number(product.stock)
        ) {
            alert("The available stock limit has been reached.");
            return;
        }

        existing.quantity = nextQuantity;

    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: price,
            category: product.category || "COLLECTION",
            image: getProductImage(product),
            quantity: 1
        });
    }

    saveCart(cart);

    const button = productGrid?.querySelector(
        `[data-product-id="${CSS.escape(String(product.id))}"]`
    );

    if (button) {
        const originalText = button.textContent;

        button.textContent = "ADDED ✓";
        button.classList.add("added-to-cart");

        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove("added-to-cart");
        }, 1400);
    }
}


// ==========================================
// 8. LOAD PRODUCTS FROM SUPABASE
// ==========================================

async function loadProducts() {
    if (!productGrid) {
        console.error("PRODUCT GRID NOT FOUND.");
        return;
    }

    productGrid.innerHTML = `
        <div class="loading">
            <span class="loading-circle"></span>
            LOADING COLLECTION...
        </div>
    `;

    try {
        const { data, error } = await db
            .from("products")
            .select("*")
            .eq("published", true)
            .order("created_at", { ascending: false });

        if (error) throw error;

        allProducts = data || [];

        filterProducts();

        console.log("PRODUCTS LOADED:", allProducts.length);

        // Handle a checkout request coming from cart.html.
        if (new URLSearchParams(window.location.search).get("checkout") === "cart") {
            await openCartCheckout();
        }

    } catch (error) {
        console.error("DATABASE ERROR:", error);

        productGrid.innerHTML = `
            <div class="empty-state">
                UNABLE TO LOAD PRODUCTS.
                <br>
                PLEASE CHECK YOUR DATABASE CONNECTION.
            </div>
        `;
    }
}


// ==========================================
// 9. DISPLAY PRODUCTS
// ==========================================

function displayProducts(products) {
    if (!productGrid) return;

    if (productCount) {
        productCount.textContent = `${products.length} PRODUCTS`;
    }

    if (products.length === 0) {
        productGrid.innerHTML = `
            <div class="empty-state">
                <h2>No Products Available</h2>
                <p>Our collection is coming soon.</p>
            </div>
        `;
        return;
    }

    productGrid.innerHTML = products.map(product => {
        const image = escapeHTML(getProductImage(product));
        const name = escapeHTML(product.name);
        const category = escapeHTML(product.category);
        const description = escapeHTML(product.description || "");
        const price = Number(product.price || 0).toFixed(2);
        const id = escapeHTML(product.id);

        const outOfStock =
            product.stock !== null &&
            product.stock !== undefined &&
            Number(product.stock) <= 0;

        return `
            <article class="product-card">

                <div class="product-image">
                    <img
                        src="${image}"
                        alt="${name}"
                        loading="lazy"
                        onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}';"
                    >
                </div>

                <div class="product-info">

                    <span class="product-category">
                        ${category}
                    </span>

                    <h3>${name}</h3>

                    <p class="product-description">
                        ${description}
                    </p>

                    <div class="product-bottom">

                        <span class="product-price">
                            ${price} DT
                        </span>

                        <button
                            class="buy-button"
                            type="button"
                            data-product-id="${id}"
                            ${outOfStock ? "disabled" : ""}
                        >
                            ${outOfStock ? "SOLD OUT" : "ADD TO BAG +"}
                        </button>

                    </div>
                </div>
            </article>
        `;
    }).join("");
}


// ==========================================
// 10. SEARCH
// ==========================================

if (searchInput) {
    searchInput.addEventListener("input", filterProducts);
}


// ==========================================
// 11. CATEGORY FILTERS
// ==========================================

document.querySelectorAll(".category-card").forEach(button => {
    button.addEventListener("click", () => {

        document.querySelectorAll(".category-card")
            .forEach(card => card.classList.remove("active"));

        button.classList.add("active");

        activeCategory = button.dataset.category || "all";

        filterProducts();
    });
});


// ==========================================
// 12. FILTER PRODUCTS
// ==========================================

function filterProducts() {
    const search = searchInput
        ? searchInput.value.toLowerCase().trim()
        : "";

    const filtered = allProducts.filter(product => {
        const name = (product.name || "").toLowerCase();
        const description = (product.description || "").toLowerCase();
        const category = product.category || "";

        const matchesCategory =
            activeCategory === "all" ||
            category === activeCategory;

        const matchesSearch =
            name.includes(search) ||
            description.includes(search) ||
            category.toLowerCase().includes(search);

        return matchesCategory && matchesSearch;
    });

    displayProducts(filtered);
}


// ==========================================
// 13. CHECKOUT STYLES
// ==========================================

function addCheckoutStyles() {
    if (document.getElementById("checkout-styles")) return;

    const style = document.createElement("style");
    style.id = "checkout-styles";

    style.textContent = `
        .checkout-overlay {
            position: fixed;
            inset: 0;
            z-index: 99999;
            background: rgba(0,0,0,.90);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 18px;
            overflow-y: auto;
        }

        .checkout-box {
            width: 100%;
            max-width: 600px;
            max-height: 92vh;
            overflow-y: auto;
            background: #101010;
            border: 1px solid #a98232;
            padding: 30px;
            color: #fff;
            position: relative;
            margin: auto;
            box-shadow: 0 15px 60px rgba(0,0,0,.6);
        }

        .checkout-box h2 {
            color: #d6b15e;
            text-align: center;
            letter-spacing: 3px;
            margin: 0 0 8px;
        }

        .checkout-subtitle {
            color: #999;
            text-align: center;
            font-size: 12px;
            margin-bottom: 25px;
        }

        .checkout-close {
            position: absolute;
            top: 12px;
            right: 16px;
            background: none;
            border: 0;
            color: #d6b15e;
            font-size: 27px;
            cursor: pointer;
        }

        .checkout-product-list {
            border-top: 1px solid #333;
            border-bottom: 1px solid #333;
            padding: 12px 0;
            margin-bottom: 22px;
        }

        .checkout-product {
            display: flex;
            justify-content: space-between;
            gap: 15px;
            padding: 9px 0;
            color: #ddd;
            font-size: 13px;
        }

        .checkout-product strong {
            color: #d6b15e;
            white-space: nowrap;
        }

        .checkout-total {
            display: flex;
            justify-content: space-between;
            gap: 15px;
            padding-top: 13px;
            margin-top: 8px;
            border-top: 1px solid #393939;
            color: #d6b15e;
            font-weight: bold;
        }

        .checkout-field {
            margin-bottom: 15px;
        }

        .checkout-field label {
            display: block;
            color: #c6a451;
            font-size: 11px;
            letter-spacing: 1px;
            margin-bottom: 7px;
        }

        .checkout-field input,
        .checkout-field textarea {
            width: 100%;
            box-sizing: border-box;
            padding: 13px;
            background: #080808;
            border: 1px solid #393939;
            color: white;
            font-size: 14px;
            outline: none;
            font-family: inherit;
        }

        .checkout-field input:focus,
        .checkout-field textarea:focus {
            border-color: #c6a451;
        }

        .checkout-field textarea {
            min-height: 90px;
            resize: vertical;
        }

        .checkout-payment {
            padding: 15px;
            border: 1px solid #66501f;
            margin: 20px 0;
            color: #ddd;
            font-size: 13px;
        }

        .checkout-payment strong {
            color: #d6b15e;
        }

        .checkout-submit {
            width: 100%;
            padding: 16px;
            border: 0;
            background: linear-gradient(135deg,#c9a34e,#8d6924);
            color: #080808;
            font-weight: bold;
            letter-spacing: 2px;
            cursor: pointer;
        }

        .checkout-submit:disabled {
            opacity: .5;
            cursor: not-allowed;
        }

        .checkout-message {
            margin-top: 15px;
            font-size: 13px;
            text-align: center;
            line-height: 1.6;
        }

        .checkout-message.error {
            color: #ff7777;
        }

        .checkout-message.success {
            color: #8bd59b;
        }

        @media(max-width:480px) {
            .checkout-box {
                padding: 25px 18px;
            }
        }
    `;

    document.head.appendChild(style);
}


// ==========================================
// 14. PREPARE CART FROM DATABASE
// ==========================================

async function prepareCartProducts() {
    const cart = getCart();

    if (cart.length === 0) {
        throw new Error("CART_EMPTY");
    }

    const ids = [...new Set(cart.map(item => String(item.id)))];

    const { data, error } = await db
        .from("products")
        .select("id, name, price, category, image_path, published, stock")
        .in("id", ids)
        .eq("published", true);

    if (error) throw error;

    const databaseProducts = data || [];

    const prepared = [];

    for (const cartItem of cart) {
        const product = databaseProducts.find(
            item => String(item.id) === String(cartItem.id)
        );

        if (!product) {
            throw new Error("PRODUCT_UNAVAILABLE");
        }

        const quantity = Number(cartItem.quantity);
        const price = Number(product.price);

        if (
            !Number.isInteger(quantity) ||
            quantity <= 0 ||
            !Number.isFinite(price) ||
            price <= 0
        ) {
            throw new Error("INVALID_PRODUCT");
        }

        if (
            product.stock !== null &&
            product.stock !== undefined &&
            quantity > Number(product.stock)
        ) {
            throw new Error("INSUFFICIENT_STOCK");
        }

        prepared.push({
            id: product.id,
            name: product.name,
            price: price,
            category: product.category || "COLLECTION",
            image: getProductImage(product),
            quantity: quantity
        });
    }

    return prepared;
}


// ==========================================
// 15. OPEN CART CHECKOUT
// ==========================================

async function openCartCheckout() {
    if (checkoutOpening) return;

    checkoutOpening = true;

    try {
        const { data, error } = await db.auth.getUser();

        if (error) throw error;

        const user = data?.user;

        if (!user) {
            alert("Veuillez vous connecter avant de passer une commande.");
            window.location.href = "login.html";
            return;
        }

        const products = await prepareCartProducts();

        addCheckoutStyles();

        document.getElementById("checkout-overlay")?.remove();

        const overlay = document.createElement("div");
        overlay.id = "checkout-overlay";
        overlay.className = "checkout-overlay";

        const total = products.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
        );

        const productHTML = products.map(item => `
            <div class="checkout-product">
                <span>
                    ${escapeHTML(item.name)}
                    × ${item.quantity}
                </span>

                <strong>
                    ${formatPrice(item.price * item.quantity)}
                </strong>
            </div>
        `).join("");

        overlay.innerHTML = `
            <div class="checkout-box">

                <button
                    type="button"
                    class="checkout-close"
                    id="checkoutClose"
                    aria-label="Close"
                >&times;</button>

                <h2>DRIP FOUSE</h2>

                <p class="checkout-subtitle">
                    COMPLETE YOUR ORDER
                </p>

                <div class="checkout-product-list">
                    ${productHTML}

                    <div class="checkout-total">
                        <span>ORDER TOTAL</span>
                        <strong>${formatPrice(total)}</strong>
                    </div>
                </div>

                <form id="checkoutForm">

                    <div class="checkout-field">
                        <label>FIRST NAME *</label>
                        <input
                            type="text"
                            name="first_name"
                            autocomplete="given-name"
                            required
                            maxlength="80"
                            placeholder="Your first name"
                        >
                    </div>

                    <div class="checkout-field">
                        <label>LAST NAME *</label>
                        <input
                            type="text"
                            name="last_name"
                            autocomplete="family-name"
                            required
                            maxlength="80"
                            placeholder="Your last name"
                        >
                    </div>

                    <div class="checkout-field">
                        <label>EMAIL ADDRESS *</label>
                        <input
                            type="email"
                            name="email"
                            autocomplete="email"
                            required
                            maxlength="254"
                            value="${escapeHTML(user.email || "")}"
                            placeholder="your@email.com"
                        >
                    </div>

                    <div class="checkout-field">
                        <label>PHONE NUMBER *</label>
                        <input
                            type="tel"
                            name="phone"
                            autocomplete="tel"
                            required
                            maxlength="12"
                            pattern="\\+216[0-9]{8}"
                            placeholder="+216XXXXXXXX"
                            value="+216"
                        >
                    </div>

                    <div class="checkout-field">
                        <label>FULL DELIVERY ADDRESS *</label>
                        <textarea
                            name="address"
                            autocomplete="street-address"
                            required
                            maxlength="500"
                            placeholder="Street, city, postal code..."
                        ></textarea>
                    </div>

                    <div class="checkout-payment">
                        PAYMENT METHOD:
                        <strong>CASH ON DELIVERY</strong>
                        <br>
                        <small>Pay when your order arrives.</small>
                    </div>

                    <button
                        type="submit"
                        class="checkout-submit"
                        id="checkoutSubmit"
                    >
                        CONFIRM ORDER
                    </button>

                    <div
                        class="checkout-message"
                        id="checkoutMessage"
                        role="status"
                    ></div>

                </form>
            </div>
        `;

        document.body.appendChild(overlay);

        const closeButton = document.getElementById("checkoutClose");

        closeButton.addEventListener("click", () => overlay.remove());

        overlay.addEventListener("click", event => {
            if (event.target === overlay) overlay.remove();
        });

        const phoneInput = overlay.querySelector('[name="phone"]');

        phoneInput.addEventListener("input", () => {
            if (!phoneInput.value.startsWith("+216")) {
                phoneInput.value = "+216";
            }
        });

        const form = document.getElementById("checkoutForm");

        form.addEventListener("submit", async event => {
            event.preventDefault();
            await submitCartOrder(form);
        });

    } catch (error) {
        console.error("CHECKOUT OPEN ERROR:", error);

        const messages = {
            CART_EMPTY: "Votre panier est vide.",
            PRODUCT_UNAVAILABLE: "Un produit de votre panier n'est plus disponible.",
            INSUFFICIENT_STOCK: "La quantité demandée dépasse le stock disponible.",
            INVALID_PRODUCT: "Un produit contient des informations invalides."
        };

        alert(
            messages[error.message] ||
            "Une erreur est survenue. Veuillez réessayer."
        );

    } finally {
        checkoutOpening = false;
    }
}


// ==========================================
// 16. SUBMIT MULTI-PRODUCT ORDER
// ==========================================

async function submitCartOrder(form) {
    const submitButton = document.getElementById("checkoutSubmit");
    const message = document.getElementById("checkoutMessage");

    if (!form.reportValidity()) return;

    const formData = new FormData(form);

    const firstName = String(formData.get("first_name") || "").trim();
    const lastName = String(formData.get("last_name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const phone = String(formData.get("phone") || "").replace(/\s/g, "");
    const address = String(formData.get("address") || "").trim();

    if (!firstName || !lastName || !email || !phone || !address) {
        message.className = "checkout-message error";
        message.textContent =
            "Veuillez remplir toutes les informations obligatoires.";
        return;
    }

    if (!/^\+216[0-9]{8}$/.test(phone)) {
        message.className = "checkout-message error";
        message.textContent =
            "Veuillez saisir un numéro tunisien valide (+216 suivi de 8 chiffres).";
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "PROCESSING...";

    message.className = "checkout-message";
    message.textContent = "";

    try {
        const { data: authData, error: authError } =
            await db.auth.getUser();

        if (authError) throw authError;

        const user = authData?.user;

        if (!user) {
            throw new Error("LOGIN_REQUIRED");
        }

        // Re-check product prices and stock from Supabase.
        const products = await prepareCartProducts();

        if (!crypto.randomUUID) {
            throw new Error("UUID_UNAVAILABLE");
        }

        const orderGroupId = crypto.randomUUID();

        const orderRows = products.map(product => ({
            order_group_id: orderGroupId,

            user_id: user.id,

            product_id: product.id,
            product_name: product.name,
            product_price: product.price,
            quantity: product.quantity,

            payment_method: "Cash on Delivery",

            status: "pending",
            status_published: false,

            first_name: firstName,
            last_name: lastName,
            email: email,
            phone: phone,
            address: address
        }));

        // One insert request for all products in the same order.
        const { error } = await db
            .from("orders")
            .insert(orderRows);

        if (error) throw error;

        // Clear the cart only after successful database insertion.
        localStorage.removeItem(CART_KEY);
        updateCartNavigation();

        message.className = "checkout-message success";
        message.textContent =
            "Votre commande a été enregistrée avec succès !";

        submitButton.textContent = "ORDER CONFIRMED";

        form.querySelectorAll("input, textarea").forEach(input => {
            input.disabled = true;
        });

        console.log("ORDER GROUP CREATED:", orderGroupId);

        const oldUrl = new URL(window.location.href);
        oldUrl.searchParams.delete("checkout");

        window.history.replaceState({}, "", oldUrl.pathname + oldUrl.search);

        // Refresh the product grid and cart navigation.
        updateCartNavigation();

    } catch (error) {
        console.error("ORDER SUBMISSION ERROR:", error);

        message.className = "checkout-message error";

        if (error.message === "LOGIN_REQUIRED") {
            message.textContent =
                "Veuillez vous connecter avant de commander.";
        } else if (error.message === "INSUFFICIENT_STOCK") {
            message.textContent =
                "La quantité demandée dépasse le stock disponible.";
        } else if (error.message === "PRODUCT_UNAVAILABLE") {
            message.textContent =
                "Un produit de votre panier n'est plus disponible.";
        } else {
            message.textContent =
                "Impossible d'enregistrer votre commande. Veuillez réessayer.";
        }

        submitButton.disabled = false;
        submitButton.textContent = "CONFIRM ORDER";
    }
}


// ==========================================
// 17. ADD TO BAG BUTTON
// ==========================================

if (productGrid) {
    productGrid.addEventListener("click", event => {
        const button = event.target.closest(".buy-button");

        if (!button || button.disabled) return;

        const product = allProducts.find(item =>
            String(item.id) === button.dataset.productId
        );

        if (!product) return;

        addToCart(product);
    });
}


// ==========================================
// 18. START STORE
// ==========================================

updateCartNavigation();

loadProducts();

console.log("DRIP FOUSE LUXURY STORE INITIALIZED!");
