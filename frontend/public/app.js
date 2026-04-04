const API_BASE_URL = "http://localhost:4000";

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
  const line = `[${now}] ${message}`;
  logBox.textContent = `${line}\n${logBox.textContent}`.trim();
  logBox.className = level;
}

function setAuthState() {
  authState.textContent = state.token ? "Logged in" : "Not logged in";
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(registerForm);

  try {
    await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: formData.get("fullName"),
        email: formData.get("email"),
        password: formData.get("password")
      })
    });
    log("Registration successful.");
  } catch (error) {
    log(`Registration failed: ${error.message}`, "err");
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);

  try {
    const result = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password")
      })
    });
    state.token = result.accessToken;
    localStorage.setItem("securestay_token", state.token);
    setAuthState();
    log("Login successful.");
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
  log("Logged out.");
});

loadHotelsBtn.addEventListener("click", async () => {
  try {
    const hotels = await request("/api/bookings/hotels");
    hotelSelect.innerHTML = hotels
      .map((hotel) => `<option value="${hotel.id}">${hotel.name} - ${hotel.city}</option>`)
      .join("");
    log(`Loaded ${hotels.length} hotel(s).`);
  } catch (error) {
    log(`Loading hotels failed: ${error.message}`, "err");
  }
});

loadRoomsBtn.addEventListener("click", async () => {
  const hotelId = hotelSelect.value;
  if (!hotelId) {
    log("Pick a hotel first.", "err");
    return;
  }

  try {
    const rooms = await request(`/api/bookings/rooms?hotelId=${hotelId}`);
    roomSelect.innerHTML = rooms
      .map(
        (room) =>
          `<option value="${room.id}" data-price="${room.pricePerNight}">Room ${room.roomNumber} - ${room.roomType} - $${room.pricePerNight}</option>`
      )
      .join("");
    log(`Loaded ${rooms.length} room(s).`);
  } catch (error) {
    log(`Loading rooms failed: ${error.message}`, "err");
  }
});

availabilityForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(availabilityForm);
  const roomId = roomSelect.value;

  if (!roomId) {
    log("Pick a room first.", "err");
    return;
  }

  const checkInDate = formData.get("checkInDate");
  const checkOutDate = formData.get("checkOutDate");

  try {
    const data = await request(
      `/api/bookings/availability?roomId=${roomId}&checkInDate=${checkInDate}&checkOutDate=${checkOutDate}`
    );
    availabilityText.textContent = data.available ? "Room is available." : "Room is not available.";
    state.selectedRoom = { roomId, checkInDate, checkOutDate };
    log(`Availability checked: ${data.available ? "available" : "unavailable"}.`);
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

  const formData = new FormData(bookingForm);

  try {
    const booking = await request("/api/bookings/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: state.selectedRoom.roomId,
        checkInDate: state.selectedRoom.checkInDate,
        checkOutDate: state.selectedRoom.checkOutDate,
        guestCount: Number(formData.get("guestCount"))
      })
    });
    state.booking = booking;
    bookingText.textContent = `Booking ${booking.id} created. Status: ${booking.status}, Total: $${booking.totalAmount}`;
    log("Booking created successfully.");
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

  const formData = new FormData(paymentForm);
  try {
    const payment = await request("/api/payments/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: state.booking.id,
        amount: state.booking.totalAmount,
        paymentMethod: "CARD",
        cardNumber: formData.get("cardNumber"),
        cardHolderName: formData.get("cardHolderName"),
        expiryMonth: Number(formData.get("expiryMonth")),
        expiryYear: Number(formData.get("expiryYear")),
        cvv: formData.get("cvv")
      })
    });

    const bookingAfter = await request(`/api/bookings/${state.booking.id}`, { method: "GET" });
    paymentText.textContent = `Payment ${payment.id} status: ${payment.status}. Booking status: ${bookingAfter.status}`;
    log(`Payment completed: ${payment.status}.`);
  } catch (error) {
    log(`Payment failed: ${error.message}`, "err");
  }
});

setAuthState();
