
// ==========================================
// DRIP FOUSE - CUSTOMER ORDER TRACKING
// LUXURY GOLD EDITION
// ==========================================

import { db } from "./supabase.js";

const ordersList = document.getElementById("orders-list");
const ordersCount = document.getElementById("orders-count");

const ORDER_STEPS = [
    { key: "pending", label: "Pending" },
    { key: "accepted", label: "Accepted" },
    { key: "processing", label: "Processing" },
    { key: "packaging", label: "Packaging" },
    { key: "out_for_delivery", label: "Out for Delivery" },
    { key: "delivered", label: "Delivered" }
];


// ==========================================
// SECURITY: ESCAPE HTML
// ==========================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}


// ==========================================
// FORMAT PRICE
// ==========================================

function formatPrice(value) {
    return `${Number(value || 0).toFixed(2)} DT`;
}


// ==========================================
// NORMALIZE ORDER STATUS
// ==========================================

function normalizeStatus(status) {
    const value = String(status || "pending")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");

    const aliases = {
        accepted: "accepted",
        processing: "processing",
        packaging: "packaging",
        out_for_delivery: "out_for_delivery",
        outfordelivery: "out_for_delivery",
        delivered: "delivered",
        pending: "pending",
        rejected: "declined",
        declined: "declined",
        cancelled: "declined",
        canceled: "declined"
    };

    return aliases[value] || "pending";
}


// ==========================================
// FORMAT DATE
// ==========================================

function formatDate(dateValue) {
    if (!dateValue) return "Date unavailable";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "Date unavailable";
    }

    return date.toLocaleString("fr-TN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}


// ==========================================
// STATUS TRACKER
// ==========================================

function createTracker(status) {
    const currentStatus = normalizeStatus(status);

    const currentIndex = ORDER_STEPS.findIndex(
        step => step.key === currentStatus
    );

    return `
        <div class="order-tracker">

            <div class="tracker-heading">
                <span>ORDER PROGRESS</span>

                <strong>
                    ${escapeHTML(
                        ORDER_STEPS[Math.max(currentIndex, 0)].label
                    )}
                </strong>
            </div>

            <div class="tracker-steps">

                ${ORDER_STEPS.map((step, index) => {
                    const completed = index <= currentIndex;
                    const active = index === currentIndex;

                    return `
                        <div class="tracker-step
                            ${completed ? "completed" : ""}
                            ${active ? "active" : ""}">

                            <div class="tracker-dot"></div>

                            <span>
                                ${escapeHTML(step.label)}
                            </span>

                        </div>
                    `;
                }).join("")}

            </div>

        </div>
    `;
}


// ==========================================
// GROUP ORDERS
// Supports old and grouped orders
// ==========================================

function groupOrders(orders) {
    const groups = new Map();

    orders.forEach(order => {
        const groupId = order.order_group_id
            ? `group-${order.order_group_id}`
            : `single-${order.id}`;

        if (!groups.has(groupId)) {
            groups.set(groupId, {
                id: order.order_group_id || order.id,
                created_at: order.created_at,
                status: order.status,
                status_published: order.status_published,
                payment_method: order.payment_method,
                items: []
            });
        }

        const group = groups.get(groupId);

        group.items.push(order);

        if (
            new Date(order.created_at) >
            new Date(group.created_at)
        ) {
            group.created_at = order.created_at;
        }
    });

    return Array.from(groups.values());
}


// ==========================================
// RENDER ONE ORDER
// ==========================================

function renderOrder(order) {
    const total = order.items.reduce((sum, item) => {
        return sum +
            Number(item.product_price || 0) *
            Number(item.quantity || 1);
    }, 0);

    const status = normalizeStatus(order.status);

    const statusLabel = status === "out_for_delivery"
        ? "OUT FOR DELIVERY"
        : status.toUpperCase().replace(/_/g, " ");

    const productsHTML = order.items.map(item => {
        const name = escapeHTML(item.product_name || "Product");
        const quantity = Number(item.quantity || 1);
        const price = formatPrice(item.product_price);

        return `
            <div class="order-product">

                <div class="order-product-image">
                    <span>DF</span>
                </div>

                <div class="order-product-info">

                    <span class="order-product-category">
                        DRIP FOUSE COLLECTION
                    </span>

                    <h3>${name}</h3>

                    <p>Quantity: ${quantity}</p>

                </div>

                <div class="order-product-price">
                    ${price}
                </div>

            </div>
        `;
    }).join("");

    return `
        <article class="order-card">

            <div class="order-top">

                <div>
                    <span class="order-number">
                        ORDER #${escapeHTML(order.id)}
                    </span>

                    <span class="order-date">
                        ${escapeHTML(formatDate(order.created_at))}
                    </span>
                </div>

                <span class="order-status status-${escapeHTML(status)}">
                    ${escapeHTML(statusLabel)}
                </span>

            </div>

            <div class="order-products">
                ${productsHTML}
            </div>

            ${createTracker(order.status)}

            <div class="order-footer">

                <div>
                    <span class="order-total-label">
                        TOTAL ORDER
                    </span>

                    <strong class="order-total">
                        ${formatPrice(total)}
                    </strong>
                </div>

                <div class="order-payment">
                    <span>PAYMENT METHOD</span>

                    <strong>
                        ${escapeHTML(
                            order.payment_method || "Not specified"
                        )}
                    </strong>
                </div>

            </div>

        </article>
    `;
}


// ==========================================
// LOAD CUSTOMER ORDERS
// ==========================================

async function loadOrders() {
    if (!ordersList) {
        console.error("ORDERS LIST NOT FOUND.");
        return;
    }

    ordersList.innerHTML = `
        <div class="orders-loading">
            <span class="loading-circle"></span>
            <p>LOADING YOUR ORDERS...</p>
        </div>
    `;

    try {

        // Check authenticated customer
        const {
            data: { user },
            error: authError
        } = await db.auth.getUser();

        if (authError) throw authError;

        if (!user) {
            ordersList.innerHTML = `
                <div class="orders-empty">

                    <h3>LOGIN REQUIRED</h3>

                    <p>
                        Please sign in to view your orders.
                    </p>

                    <a href="login.html">
                        SIGN IN
                    </a>

                </div>
            `;

            if (ordersCount) {
                ordersCount.textContent = "0";
            }

            return;
        }

        // Load only this customer's orders.
        const { data: orders, error } = await db
            .from("orders")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        if (error) throw error;

        // No orders found
        if (!orders || orders.length === 0) {
            showEmptyOrders();
            return;
        }

        // Group products belonging to the same checkout
        const groupedOrders = groupOrders(orders);

        // ======================================
        // IMPORTANT:
        // Hide declined orders from customer only.
        // Do NOT delete anything from Supabase.
        // ======================================

        const visibleOrders = groupedOrders.filter(order => {

            // If ANY product in the same order group
            // is declined, hide the complete order.
            return !order.items.some(item =>
                normalizeStatus(item.status) === "declined"
            );

        });

        // Update visible order count
        if (ordersCount) {
            ordersCount.textContent = String(visibleOrders.length);
        }

        // If every order is declined
        if (visibleOrders.length === 0) {
            showEmptyOrders();
            return;
        }

        // Render only visible orders
        ordersList.innerHTML = visibleOrders
            .map(order => renderOrder(order))
            .join("");

    } catch (error) {

        console.error("ORDER LOADING ERROR:", error);

        ordersList.innerHTML = `
            <div class="orders-error">

                <h3>UNABLE TO LOAD ORDERS</h3>

                <p>
                    Something went wrong while loading your orders.
                    Please try again.
                </p>

                <button id="retry-orders">
                    TRY AGAIN
                </button>

            </div>
        `;

        const retryButton = document.getElementById("retry-orders");

        if (retryButton) {
            retryButton.addEventListener("click", loadOrders);
        }
    }
}


// ==========================================
// EMPTY ORDERS DISPLAY
// ==========================================

function showEmptyOrders() {

    ordersList.innerHTML = `
        <div class="orders-empty">

            <h3>NO ORDERS YET</h3>

            <p>
                Your next favourite piece is waiting for you.
            </p>

            <a href="index.html#products">
                EXPLORE COLLECTION
            </a>

        </div>
    `;

    if (ordersCount) {
        ordersCount.textContent = "0";
    }
}


// ==========================================
// MOBILE NAVIGATION
// ==========================================

const mobileMenu = document.getElementById("mobile-menu");
const navLinks = document.querySelector(".nav-links");

if (mobileMenu && navLinks) {

    function closeMobileMenu() {
        navLinks.classList.remove("menu-open");

        mobileMenu.setAttribute("aria-expanded", "false");

        mobileMenu.setAttribute(
            "aria-label",
            "Open navigation menu"
        );
    }

    mobileMenu.setAttribute("aria-expanded", "false");

    mobileMenu.addEventListener("click", () => {

        const isOpen = navLinks.classList.toggle("menu-open");

        mobileMenu.setAttribute(
            "aria-expanded",
            String(isOpen)
        );

        mobileMenu.setAttribute(
            "aria-label",
            isOpen
                ? "Close navigation menu"
                : "Open navigation menu"
        );

    });

    navLinks.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", closeMobileMenu);
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeMobileMenu();
        }
    });

    document.addEventListener("click", event => {

        if (
            !navLinks.contains(event.target) &&
            !mobileMenu.contains(event.target)
        ) {
            closeMobileMenu();
        }

    });
}


// ==========================================
// INITIALIZE
// ==========================================

loadOrders();
