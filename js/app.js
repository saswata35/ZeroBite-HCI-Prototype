/**
 * ZeroBite Campus — Application State, Payment Gateway & UI Controller
 */
const AppState = {
  cart: [],
  activeFilter: "all",
  selectedSlot: "12:30 PM",
  slotDiscountPercent: 0,
  portionMode: "regular",
  paymentMethod: "upi",
  lastRemovedItem: null,
  isLargeText: false,
  isHighContrast: false
};

/* --------------------------------------------------------------------------
   1. Price & Ecological Calculation Helper
   -------------------------------------------------------------------------- */
function calculateOrderSummary() {
  let subtotal = 0;
  let totalItems = 0;

  AppState.cart.forEach(item => {
    subtotal += item.price * item.qty;
    totalItems += item.qty;
  });

  const portionDiscount = AppState.portionMode === "lite"
    ? totalItems * HCI_CONFIG.LITE_PORTION_DISCOUNT_INR
    : 0;
  const slotDiscount = Math.round((subtotal - portionDiscount) * (AppState.slotDiscountPercent / 100));
  const totalDiscount = portionDiscount + slotDiscount;
  const finalTotal = Math.max(0, subtotal - totalDiscount);

  const wasteSavedGrams = (totalItems * HCI_CONFIG.BASE_WASTE_PREVENTED_GRAMS) +
    (AppState.portionMode === "lite" ? totalItems * HCI_CONFIG.LITE_EXTRA_WASTE_SAVED_GRAMS : 0);

  return { subtotal, totalDiscount, finalTotal, totalItems, wasteSavedGrams };
}

/* --------------------------------------------------------------------------
   2. Rendering Functions
   -------------------------------------------------------------------------- */
function renderMenu() {
  const grid = document.getElementById("menuGrid");
  const filtered = AppState.activeFilter === "all"
    ? MENU_ITEMS
    : MENU_ITEMS.filter(item => item.categories.includes(AppState.activeFilter));

  document.getElementById("menuCountLabel").textContent =
    `Showing ${filtered.length} curated meal${filtered.length === 1 ? "" : "s"}`;

  grid.innerHTML = filtered.map(item => `
    <article class="card-surface bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-emerald-500 transition">
      <div>
        <div class="flex justify-between items-start gap-2">
          <h3 class="font-bold text-slate-900 text-base">${item.name}</h3>
          <span class="font-bold text-emerald-700 text-base">₹${item.price}</span>
        </div>
        <p class="text-xs text-slate-500 mt-1.5 leading-relaxed">${item.description}</p>
      </div>
      <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span class="text-[11px] font-medium text-slate-500">${item.kcal} kcal • Prep ${item.prepTime}</span>
        <button type="button" data-add-id="${item.id}"
          class="add-item-btn fitts-target px-4 py-2 rounded-xl bg-slate-900 hover:bg-emerald-600 text-white text-xs font-bold transition">
          + Add to Tray
        </button>
      </div>
    </article>
  `).join("");
}

function renderCart() {
  const list = document.getElementById("cartList");
  const checkoutBtn = document.getElementById("checkoutBtn");

  if (AppState.cart.length === 0) {
    list.innerHTML = `<p class="text-sm text-slate-400 text-center py-6">Your tray is empty. Select a meal to start.</p>`;
    document.getElementById("subtotalAmt").textContent = "₹0";
    document.getElementById("discountAmt").textContent = "-₹0";
    document.getElementById("totalAmt").textContent = "₹0";
    checkoutBtn.disabled = true;
    return;
  }

  checkoutBtn.disabled = false;
  list.innerHTML = AppState.cart.map(item => `
    <div class="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200 gap-2">
      <div class="min-w-0">
        <p class="text-xs font-bold text-slate-900 truncate">${item.name}</p>
        <p class="text-[11px] text-slate-500">₹${item.price} × ${item.qty} = ₹${item.price * item.qty}</p>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button type="button" data-dec-id="${item.id}" aria-label="Decrease quantity of ${item.name}"
          class="fitts-target px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-800">
          −
        </button>
        <span class="text-xs font-bold w-5 text-center">${item.qty}</span>
        <button type="button" data-inc-id="${item.id}" aria-label="Increase quantity of ${item.name}"
          class="fitts-target px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-800">
          +
        </button>
      </div>
    </div>
  `).join("");

  const { subtotal, totalDiscount, finalTotal } = calculateOrderSummary();
  document.getElementById("subtotalAmt").textContent = `₹${subtotal}`;
  document.getElementById("discountAmt").textContent = `-₹${totalDiscount}`;
  document.getElementById("totalAmt").textContent = `₹${finalTotal}`;
}

function openPaymentGatewayView() {
  const { subtotal, totalDiscount, finalTotal, wasteSavedGrams } = calculateOrderSummary();

  document.getElementById("gatewaySlot").textContent = AppState.selectedSlot;
  document.getElementById("gatewayPortion").textContent = AppState.portionMode;
  document.getElementById("gatewayWaste").textContent = `~${wasteSavedGrams} grams`;
  document.getElementById("gatewaySubtotal").textContent = `₹${subtotal}`;
  document.getElementById("gatewayDiscount").textContent = `-₹${totalDiscount}`;
  document.getElementById("gatewayTotal").textContent = `₹${finalTotal}`;
  document.getElementById("payBtnAmount").textContent = `₹${finalTotal}`;

  document.getElementById("gatewayItemList").innerHTML = AppState.cart.map(item => `
    <div class="flex justify-between text-slate-700">
      <span>${item.name} × ${item.qty}</span>
      <span class="font-semibold">₹${item.price * item.qty}</span>
    </div>
  `).join("");

  hidePaymentError();
  document.getElementById("mainWorkspace").classList.add("hidden");
  document.getElementById("paymentView").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
  telemetry.record("OPEN_GATEWAY", `Opened Payment Gateway (Payable: ₹${finalTotal})`);
}

function returnToMealWorkspace() {
  document.getElementById("paymentView").classList.add("hidden");
  document.getElementById("mainWorkspace").classList.remove("hidden");
  telemetry.record("RETURN_TO_TRAY", "Navigated back to meal selection tray");
}

/* --------------------------------------------------------------------------
   3. Cart & Payment Validation Controllers
   -------------------------------------------------------------------------- */
function addItemToCart(id) {
  const menuItem = MENU_ITEMS.find(m => m.id === id);
  if (!menuItem) return;

  const existing = AppState.cart.find(c => c.id === id);
  if (existing) existing.qty += 1;
  else AppState.cart.push({ ...menuItem, qty: 1 });

  hideUndoToast();
  telemetry.record("ADD_ITEM", `Added "${menuItem.name}" to tray`);
  renderCart();
}

function decrementOrRemoveItem(id) {
  const index = AppState.cart.findIndex(c => c.id === id);
  if (index === -1) return;

  const item = AppState.cart[index];
  if (item.qty > 1) {
    item.qty -= 1;
    telemetry.record("DECREMENT_QTY", `Decreased "${item.name}" to ${item.qty}`);
  } else {
    AppState.lastRemovedItem = { ...item };
    AppState.cart.splice(index, 1);
    showUndoToast(item.name);
    telemetry.record("REMOVE_ITEM", `Removed "${item.name}" (Undo offered)`);
  }
  renderCart();
}

function showUndoToast(itemName) {
  const toast = document.getElementById("undoToast");
  document.getElementById("undoMessage").textContent = `Removed ${itemName}`;
  toast.classList.remove("hidden");
  toast.classList.add("flex");
}

function hideUndoToast() {
  const toast = document.getElementById("undoToast");
  toast.classList.add("hidden");
  toast.classList.remove("flex");
}

function undoLastRemoval() {
  if (!AppState.lastRemovedItem) return;
  AppState.cart.push(AppState.lastRemovedItem);
  telemetry.recordUndo(AppState.lastRemovedItem.name);
  AppState.lastRemovedItem = null;
  hideUndoToast();
  renderCart();
}

function showPaymentError(msg) {
  const errEl = document.getElementById("paymentErrorMsg");
  errEl.textContent = msg;
  errEl.classList.remove("hidden");
}

function hidePaymentError() {
  document.getElementById("paymentErrorMsg").classList.add("hidden");
}

function validateAndProcessPayment() {
  hidePaymentError();

  if (AppState.paymentMethod === "upi") {
    const upi = document.getElementById("upiInput").value.trim();
    if (!upi || !upi.includes("@")) {
      showPaymentError("Please enter a valid UPI ID containing '@' (e.g., saswata@okicici).");
      return false;
    }
  } else if (AppState.paymentMethod === "card") {
    const num = document.getElementById("cardNumberInput").value.replace(/\s+/g, "");
    const exp = document.getElementById("cardExpiryInput").value.trim();
    const cvv = document.getElementById("cardCvvInput").value.trim();
    if (num.length < 12 || !exp.includes("/") || cvv.length < 3) {
      showPaymentError("Please enter valid Card Number, Expiry (MM/YY), and 3-digit CVV.");
      return false;
    }
  } else if (AppState.paymentMethod === "wallet") {
    const studentId = document.getElementById("studentIdInput").value.trim();
    if (!studentId) {
      showPaymentError("Please enter your University Roll / Smart Card ID.");
      return false;
    }
  }

  const methodLabels = {
    upi: "UPI Instant Pay",
    card: "Debit / Credit Card",
    wallet: "Campus Meal Wallet"
  };

  const { finalTotal, wasteSavedGrams } = calculateOrderSummary();
  document.getElementById("modalSlot").textContent = AppState.selectedSlot;
  document.getElementById("modalToken").textContent = `#ZB-${Math.floor(100 + Math.random() * 900)}`;
  document.getElementById("modalPayMethod").textContent = methodLabels[AppState.paymentMethod];
  document.getElementById("modalAmountPaid").textContent = `₹${finalTotal}`;
  document.getElementById("modalWasteSaved").textContent = `~${wasteSavedGrams} grams`;

  document.getElementById("orderModal").classList.remove("hidden");
  telemetry.record("PAYMENT_SUCCESS", `Paid ₹${finalTotal} via ${methodLabels[AppState.paymentMethod]}`);
  return true;
}

/* --------------------------------------------------------------------------
   4. Event Listeners & Keyboard Affordances
   -------------------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  renderMenu();
  renderCart();

  // Pickup Slot Selection
  document.getElementById("slotGroup").addEventListener("click", (e) => {
    const btn = e.target.closest(".slot-btn");
    if (!btn) return;

    AppState.selectedSlot = btn.dataset.slot;
    AppState.slotDiscountPercent = Number(btn.dataset.discount || 0);

    document.getElementById("selectedSlotBadge").textContent = AppState.selectedSlot;
    document.getElementById("pickupEta").textContent = `Est. Queue Wait: ${btn.dataset.wait}`;

    document.querySelectorAll(".slot-btn").forEach(b => {
      b.setAttribute("aria-checked", "false");
      b.className = "slot-btn fitts-target rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-sm p-2.5 text-left sm:text-center hover:border-slate-400 transition";
    });

    btn.setAttribute("aria-checked", "true");
    btn.className = "slot-btn fitts-target rounded-xl border-2 border-emerald-600 bg-emerald-50 text-emerald-950 font-semibold text-sm p-2.5 text-left sm:text-center transition";

    telemetry.record("SELECT_SLOT", `Selected pickup slot: ${AppState.selectedSlot}`);
    renderCart();
  });

  // Hick's Law Category Filters
  document.getElementById("filterGroup").addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;

    AppState.activeFilter = btn.dataset.filter;
    document.querySelectorAll(".filter-btn").forEach(b => {
      b.setAttribute("aria-selected", "false");
      b.className = "filter-btn fitts-target px-4 py-2 rounded-full text-sm font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition";
    });

    btn.setAttribute("aria-selected", "true");
    btn.className = "filter-btn fitts-target px-4 py-2 rounded-full text-sm font-semibold bg-slate-900 text-white transition";

    telemetry.record("FILTER_MENU", `Filtered menu by: ${AppState.activeFilter}`);
    renderMenu();
  });

  // Menu Card Add Buttons
  document.getElementById("menuGrid").addEventListener("click", (e) => {
    const btn = e.target.closest(".add-item-btn");
    if (btn) addItemToCart(Number(btn.dataset.addId));
  });

  // Cart Quantity Steppers
  document.getElementById("cartList").addEventListener("click", (e) => {
    const incBtn = e.target.closest("[data-inc-id]");
    const decBtn = e.target.closest("[data-dec-id]");
    if (incBtn) addItemToCart(Number(incBtn.dataset.incId));
    if (decBtn) decrementOrRemoveItem(Number(decBtn.dataset.decId));
  });

  // Portion Calibration Toggle
  document.querySelectorAll(".portion-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      AppState.portionMode = btn.dataset.portion;
      const isLite = AppState.portionMode === "lite";

      document.getElementById("portionRegular").setAttribute("aria-checked", String(!isLite));
      document.getElementById("portionLite").setAttribute("aria-checked", String(isLite));

      document.getElementById("portionRegular").className = !isLite
        ? "portion-btn fitts-target py-2 px-3 rounded-lg text-xs font-bold border-2 border-slate-900 bg-slate-900 text-white transition"
        : "portion-btn fitts-target py-2 px-3 rounded-lg text-xs font-bold border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition";

      document.getElementById("portionLite").className = isLite
        ? "portion-btn fitts-target py-2 px-3 rounded-lg text-xs font-bold border-2 border-emerald-600 bg-emerald-600 text-white transition"
        : "portion-btn fitts-target py-2 px-3 rounded-lg text-xs font-bold border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition";

      document.getElementById("wasteSavedTag").textContent = isLite
        ? "Lite (-120g plate waste)"
        : "Standard (0g saved)";

      telemetry.record("CALIBRATE_PORTION", `Portion set to: ${AppState.portionMode}`);
      renderCart();
    });
  });

  // Undo Button
  document.getElementById("undoBtn").addEventListener("click", undoLastRemoval);

  // Proceed to Payment Gateway View
  document.getElementById("checkoutBtn").addEventListener("click", openPaymentGatewayView);

  // Return to Meal Tray from Payment Gateway
  document.getElementById("backToMenuBtn").addEventListener("click", returnToMealWorkspace);

  // Payment Gateway: Switch Between 3 Payment Methods
  document.getElementById("paymentMethodGroup").addEventListener("click", (e) => {
    const btn = e.target.closest(".pay-method-btn");
    if (!btn) return;

    AppState.paymentMethod = btn.dataset.method;
    hidePaymentError();

    document.querySelectorAll(".pay-method-btn").forEach(b => {
      b.setAttribute("aria-checked", "false");
      b.className = "pay-method-btn fitts-target p-3 rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-slate-400 text-left transition";
    });

    btn.setAttribute("aria-checked", "true");
    btn.className = "pay-method-btn fitts-target p-3 rounded-xl border-2 border-emerald-600 bg-emerald-50 text-emerald-950 text-left transition";

    document.querySelectorAll(".payment-panel").forEach(panel => panel.classList.add("hidden"));
    document.getElementById(`panel-${AppState.paymentMethod}`).classList.remove("hidden");

    telemetry.record("SELECT_PAYMENT_METHOD", `Selected payment method: ${AppState.paymentMethod.toUpperCase()}`);
  });

  // Pay Now Button
  document.getElementById("payNowBtn").addEventListener("click", validateAndProcessPayment);

  // Close Confirmation Modal & Reset Session Cart
  document.getElementById("closeModalBtn").addEventListener("click", () => {
    document.getElementById("orderModal").classList.add("hidden");
    AppState.cart = [];
    hideUndoToast();
    renderCart();
    returnToMealWorkspace();
  });

  // Universal Design Controls
  document.getElementById("toggleFontBtn").addEventListener("click", (e) => {
    AppState.isLargeText = !AppState.isLargeText;
    e.currentTarget.setAttribute("aria-pressed", String(AppState.isLargeText));
    document.documentElement.style.fontSize = AppState.isLargeText
      ? HCI_CONFIG.FONT_SCALE_LARGE
      : HCI_CONFIG.FONT_SCALE_DEFAULT;
    telemetry.record("A11Y_FONT_SCALE", `Text scaling: ${AppState.isLargeText ? "112.5%" : "100%"}`);
  });

  document.getElementById("toggleContrastBtn").addEventListener("click", (e) => {
    AppState.isHighContrast = !AppState.isHighContrast;
    e.currentTarget.setAttribute("aria-pressed", String(AppState.isHighContrast));
    document.getElementById("appBody").classList.toggle("high-contrast", AppState.isHighContrast);
    telemetry.record("A11Y_CONTRAST", `High contrast mode: ${AppState.isHighContrast ? "ON" : "OFF"}`);
  });

  // Telemetry Drawer Controls
  const drawer = document.getElementById("hciDrawer");
  const openDrawerBtn = document.getElementById("openTelemetryBtn");

  openDrawerBtn.addEventListener("click", () => {
    const isHidden = drawer.classList.toggle("hidden");
    openDrawerBtn.setAttribute("aria-expanded", String(!isHidden));
  });

  document.getElementById("closeTelemetryBtn").addEventListener("click", () => {
    drawer.classList.add("hidden");
    openDrawerBtn.setAttribute("aria-expanded", "false");
  });

  document.getElementById("exportTelemetryBtn").addEventListener("click", () => {
    telemetry.exportSessionJson();
  });

  // Global Escape Key Handler
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.getElementById("orderModal").classList.add("hidden");
      drawer.classList.add("hidden");
      openDrawerBtn.setAttribute("aria-expanded", "false");
    }
  });
});