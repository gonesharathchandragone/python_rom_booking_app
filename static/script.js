const $ = (id) => document.getElementById(id);
const rupees = (n) => "₹" + n.toLocaleString("en-IN");
let selectedRoom = null;
let currentSearch = null;

// Date limits: today onward, check-out after check-in
const iso = (d) => d.toISOString().slice(0, 10);
const today = new Date();
const tomorrow = new Date(Date.now() + 86400000);
$("checkin").min = iso(today);
$("checkin").value = iso(tomorrow);
$("checkout").value = iso(new Date(Date.now() + 3 * 86400000));
$("checkin").addEventListener("change", () => {
  const next = new Date($("checkin").value);
  next.setDate(next.getDate() + 1);
  $("checkout").min = iso(next);
  if ($("checkout").value <= $("checkin").value) $("checkout").value = iso(next);
});

async function searchRooms(event) {
  if (event) event.preventDefault();
  const checkin = $("checkin").value;
  const checkout = $("checkout").value;
  const guests = $("guests").value;
  $("search-error").textContent = "";

  if (!checkin || !checkout || checkout <= checkin) {
    $("search-error").textContent = "Pick a check-out date after your check-in date.";
    return;
  }
  const params = new URLSearchParams({ checkin, checkout, guests });
  try {
    const res = await fetch("/api/rooms?" + params);
    const rooms = await res.json();
    currentSearch = { checkin, checkout, guests: Number(guests) };
    renderRooms(rooms);
    if (event) $("rooms").scrollIntoView({ behavior: "smooth" });
  } catch {
    $("search-error").textContent = "Couldn't load rooms. Check that the server is running and try again.";
  }
}

function renderRooms(rooms) {
  const list = $("room-list");
  list.innerHTML = "";
  const nights = rooms[0] && rooms[0].nights;
  $("summary").textContent = rooms.length
    ? `${rooms.length} rooms available${nights ? ` for ${nights} night${nights > 1 ? "s" : ""}` : ""}`
    : "";

  if (!rooms.length) {
    list.innerHTML = '<p class="empty">No room fits that many guests. Try fewer guests or split the party across two rooms.</p>';
    return;
  }
  rooms.forEach((room) => {
    const row = document.createElement("article");
    row.className = "room";
    row.innerHTML = `
      <div class="swatch" style="background:${room.tone}">${room.size} m²</div>
      <div>
        <h3>${room.name}</h3>
        <p class="facts">Sleeps ${room.sleeps} · ${room.bed}</p>
        <p>${room.blurb}</p>
      </div>
      <div class="price">
        <strong>${rupees(room.price)}</strong>
        <span>per night${room.total ? ` · ${rupees(room.total)} total` : ""}</span>
        <button type="button">Book this room</button>
      </div>`;
    row.querySelector("button").addEventListener("click", () => openDialog(room));
    list.appendChild(row);
  });
}

function openDialog(room) {
  selectedRoom = room;
  $("dialog-title").textContent = room.name;
  $("dialog-sub").textContent =
    `${currentSearch.checkin} to ${currentSearch.checkout} · ${currentSearch.guests} guest(s)` +
    (room.total ? ` · ${rupees(room.total)}` : "");
  $("form-error").textContent = "";
  $("booking-form").hidden = false;
  $("confirmation").hidden = true;
  $("dialog").showModal();
  $("name").focus();
}

async function submitBooking(event) {
  event.preventDefault();
  $("form-error").textContent = "";
  try {
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room_id: selectedRoom.id,
        name: $("name").value,
        email: $("email").value,
        ...currentSearch,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      $("form-error").textContent = data.error;
      return;
    }
    $("booking-form").hidden = true;
    $("confirmation").hidden = false;
    $("confirm-text").textContent =
      `${data.room}, ${data.nights} night(s), ${rupees(data.total)}. ` +
      `Your reference is ${data.reference}. A confirmation goes to ${data.email}.`;
  } catch {
    $("form-error").textContent = "Couldn't reach the server. Try again.";
  }
}

$("search").addEventListener("submit", searchRooms);
$("booking-form").addEventListener("submit", submitBooking);
$("cancel").addEventListener("click", () => $("dialog").close());
$("close").addEventListener("click", () => $("dialog").close());
searchRooms();
