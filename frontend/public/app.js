const API_BASE_URL = "http://192.168.49.2:30080";

const state = {
  token: localStorage.getItem("securestay_token") || "",
  selectedRoom: null,
  booking: null
};

const logBox = document.getElementById("logBox");
const authState = document.getElementById("authState");

const registerForm = document.getElementById("registerForm");
const loginForm = document.getElementById("loginForm");
const availabilityForm = document.getElementById("availabilityForm");
const bookingForm = document.getElementById("bookingForm");
const paymentForm = document.getElementById("paymentForm");
const hotelSelect = document.getElementById("hotelSelect");
const roomSelect = document.getElementById("roomSelect");
const loadHotelsBtn = document.getElementById("loadHotelsBtn");
const loadRoomsBtn = document.getElementById("loadRoomsBtn");
const logoutBtn = document.getElementById("logoutBtn");

const availabilityText = document.getElementById("availabilityText");
const bookingText = document.getElementById("bookingText");
const paymentText = document.getElementById("paymentText");

function log(message, level = "ok") {
  const now = new Date().toLocaleTimeString();
  const line = document.createElement("span");
  line.className = level === "err" ? "log-err" : "log-ok";
  line.textContent = `[${now}] ${message}\n`;
  logBox.prepend(line);
}

function setAuthState() {
  if (state.token) {
    authState.textContent = "● Logged in";
    authState.classList.add("logged");
  } else {
    authState.innerHTML = '<span class="auth-dot"></span> Not logged in';
    authState.classList.remove("logged");
  }
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);

  return data;
}

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const fd = new FormData(registerForm);
  try {
    await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: fd.get("fullName"), email: fd.get("email"), password: fd.get("password") })
    });
    log("Registration successful. Please sign in.");
  } catch (error) {
    log(`Registration failed: ${error.message}`, "err");
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const fd = new FormData(loginForm);
  try {
    const result = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") })
    });
    state.token = result.accessToken;
    localStorage.setItem("securestay_token", state.token);
    setAuthState();
    log("Login successful. Welcome back!");
  } catch (error) {
    log(`Login failed: ${error.message}`, "err");
  }
});

logoutBtn.addEventListener("click", () => {
  state.token = "";
  state.booking = null;
  localStorage.removeItem("securestay_token");
  setAuthState();
  bookingText.textContent = "No booking yet.";
  paymentText.textContent = "No payment yet.";
  log("Signed out successfully.");
});

loadHotelsBtn.addEventListener("click", async () => {
  try {
    const hotels = await request("/api/bookings/hotels");
    hotelSelect.innerHTML =
      '<option value="">— Choose a hotel —</option>' +
      hotels.map(h => `<option value="${h.id}">${h.name} - ${h.city}</option>`).join("");
    log(`Loaded ${hotels.length} hotel(s).`);
  } catch (error) {
    log(`Loading hotels failed: ${error.message}`, "err");
  }
});

loadRoomsBtn.addEventListener("click", async () => {
  const hotelId = hotelSelect.value;
  if (!hotelId) { log("Select a hotel first.", "err"); return; }
  try {
    const rooms = await request(`/api/bookings/rooms?hotelId=${hotelId}`);
    roomSelect.innerHTML =
      '<option value="">— Choose a room —</option>' +
      rooms.map(r => `<option value="${r.id}" data-price="${r.pricePerNight}">Room ${r.roomNumber} · ${r.roomType} · $${r.pricePerNight}/night</option>`).join("");
    log(`Loaded ${rooms.length} room(s).`);
  } catch (error) {
    log(`Loading rooms failed: ${error.message}`, "err");
  }
});

availabilityForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const fd = new FormData(availabilityForm);
  const roomId = roomSelect.value;
  if (!roomId) { log("Select a room first.", "err"); return; }

  const checkInDate = fd.get("checkInDate");
  const checkOutDate = fd.get("checkOutDate");
  try {
    const data = await request(`/api/bookings/availability?roomId=${roomId}&checkInDate=${checkInDate}&checkOutDate=${checkOutDate}`);
    availabilityText.textContent = data.available ? "✓ Room is available for your dates." : "✗ Room is not available for selected dates.";
    availabilityText.style.color = data.available ? "var(--ok)" : "var(--err)";
    state.selectedRoom = { roomId, checkInDate, checkOutDate };
    log(`Availability: ${data.available ? "available ✓" : "unavailable ✗"}.`);
  } catch (error) {
    log(`Availability check failed: ${error.message}`, "err");
  }
});

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.token) {
    log("Login first to create a booking.", "err");
    return;
  }
  if (!state.selectedRoom) {
    log("Check room availability first.", "err");
    return;
  }

  const fd = new FormData(bookingForm);
  try {
    const booking = await request("/api/bookings/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: state.selectedRoom.roomId,
        checkInDate: state.selectedRoom.checkInDate,
        checkOutDate: state.selectedRoom.checkOutDate,
        guestCount: Number(fd.get("guestCount"))
      })
    });
    state.booking = booking;
    bookingText.textContent = `Booking #${booking.id} — Status: ${booking.status} — Total: $${booking.totalAmount}`;
    bookingText.style.color = "var(--ok)";
    log("Booking created successfully!");
  } catch (error) {
    log(`Booking failed: ${error.message}`, "err");
  }
});

paymentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.token) {
    log("Login first to make a payment.", "err");
    return;
  }
  if (!state.booking) {
    log("Create a booking first.", "err");
    return;
  }

  const fd = new FormData(paymentForm);
  try {
    const payment = await request("/api/payments/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: state.booking.id,
        amount: state.booking.totalAmount,
        paymentMethod: "CARD",
        cardNumber: fd.get("cardNumber"),
        cardHolderName: fd.get("cardHolderName"),
        expiryMonth: Number(fd.get("expiryMonth")),
        expiryYear: Number(fd.get("expiryYear")),
        cvv: fd.get("cvv")
      })
    });
    const bookingAfter = await request(`/api/bookings/${state.booking.id}`, { method: "GET" });
    paymentText.textContent = `Payment #${payment.id} — Status: ${payment.status} · Booking: ${bookingAfter.status}`;
    paymentText.style.color = payment.status === "SUCCESS" ? "var(--ok)" : "var(--err)";
    log(`Payment ${payment.status === "SUCCESS" ? "completed ✓" : "failed ✗"}: ${payment.status}`);
  } catch (error) {
    log(`Payment failed: ${error.message}`, "err");
  }
});

setAuthState();
