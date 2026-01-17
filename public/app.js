const availableBtn = document.getElementById("available-btn");
const simulateToggle = document.getElementById("simulate-toggle");
const simulateInputs = document.getElementById("simulate-inputs");
const simLat = document.getElementById("sim-lat");
const simLon = document.getElementById("sim-lon");
const pushSimBtn = document.getElementById("push-sim-location");
const usersList = document.getElementById("users-list");

let pollTimer = null;
let isAvailable = false;

async function bootstrap() {
  await amplitudeClient.initFromServer();
  await fetchMe();
  wireEvents();

  // Initial State: Sidebar is open, so hide the floating toggle
  const desktopSidebarToggle = document.getElementById(
    "desktop-sidebar-toggle",
  );
  if (desktopSidebarToggle && window.innerWidth > 768) {
    desktopSidebarToggle.classList.add("hidden");
  }

  if (authUI.getUser()) {
    startPolling();
    suggestionsUI.fetchSuggestions();
  }
}

async function fetchMe() {
  try {
    const res = await fetch("/api/me");
    if (!res.ok) return;
    const data = await res.json();
    authUI.setUser(data.user);
  } catch (err) {
    console.error(err);
  }
}

function wireEvents() {
  availableBtn.addEventListener("click", async () => {
    await setAvailability(!isAvailable);
  });

  simulateToggle.addEventListener("change", (e) => {
    simulateInputs.classList.toggle("hidden", !e.target.checked);
  });
  pushSimBtn.addEventListener("click", sendLocation);

  const sidebar = document.getElementById("sidebar");
  const desktopSidebarToggle = document.getElementById(
    "desktop-sidebar-toggle",
  );
  const sidebarCloseBtn = document.getElementById("sidebar-close-btn");
  const bottomNavItems = document.querySelectorAll(".nav-item");

  function toggleSidebar(show) {
    if (show) {
      sidebar.classList.remove("collapsed");
      desktopSidebarToggle.classList.add("hidden");
    } else {
      sidebar.classList.add("collapsed");
      desktopSidebarToggle.classList.remove("hidden");
    }
    setTimeout(() => {
      mapUI.map.invalidateSize();
    }, 300);
  }

  // Sidebar Open (Desktop)
  desktopSidebarToggle?.addEventListener("click", () => {
    toggleSidebar(true);
  });

  // Sidebar Close (Desktop)
  sidebarCloseBtn?.addEventListener("click", () => {
    toggleSidebar(false);
  });

  // Desktop Sidebar Navigation
  const desktopNavIcons = document.querySelectorAll(".nav-icon");
  const sidebarTitle = document.getElementById("sidebar-title");
  const activitiesPanel = document.getElementById("activities-panel");
  const profilePanel = document.getElementById("profile-panel");

  desktopNavIcons.forEach((btn) => {
    btn.addEventListener("click", () => {
      // 1. Update Active State
      desktopNavIcons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // 2. Open sidebar if collapsed
      if (sidebar.classList.contains("collapsed")) {
        toggleSidebar(true);
      }

      // 3. Switch Content
      const targetId = btn.dataset.target;
      if (targetId === "activities-panel") {
        activitiesPanel.classList.remove("hidden");
        profilePanel.classList.add("hidden");
        if (sidebarTitle) sidebarTitle.textContent = "Activities";
      } else if (targetId === "profile-panel") {
        profilePanel.classList.remove("hidden");
        activitiesPanel.classList.add("hidden");
        if (sidebarTitle) sidebarTitle.textContent = "Profile & Settings";
      }
    });
  });

  // Mobile Navigation
  bottomNavItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      const isActive = btn.classList.contains("active");

      // Always reset active state first
      bottomNavItems.forEach((b) => b.classList.remove("active"));

      // If clicking already active tab -> Close (Toggle off)
      if (isActive) {
        sidebar.classList.remove("mobile-open");
        sidebar.classList.remove("show-activities");
        sidebar.classList.remove("show-profile");
        return;
      }

      // Otherwise -> Open and set Active
      btn.classList.add("active");
      const target = btn.dataset.target;

      if (target === "activities-panel") {
        sidebar.classList.add("mobile-open");
        sidebar.classList.add("show-activities");
        sidebar.classList.remove("show-profile");
      } else if (target === "profile-panel") {
        sidebar.classList.add("mobile-open");
        sidebar.classList.add("show-profile");
        sidebar.classList.remove("show-activities");
      }
    });
  });

  suggestionsUI.setHandlers({
    onPage: (toUserId) => pageUser(toUserId),
    onAvailability: (available) => setAvailability(available),
  });

  startLocationWatch();
}

let lastLat = null;
let lastLon = null;

function startLocationWatch() {
  if (!navigator.geolocation) return;
  navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      lastLat = latitude;
      lastLon = longitude;
      mapUI.updateMyMarker(latitude, longitude, isAvailable);
    },
    (err) => console.log("Location watch error", err),
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 },
  );
}

async function setAvailability(available) {
  if (!authUI.getUser()) {
    alert("Login first");
    return;
  }
  const res = await fetch("/api/availability", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ available }),
  });
  if (!res.ok) {
    const err = await res.json();
    alert(err.error || "Failed to update availability");
    return;
  }
  isAvailable = available;

  // Update Button State
  if (isAvailable) {
    availableBtn.textContent = "Location: Shared";
    availableBtn.classList.remove("hidden-state");
    availableBtn.classList.add("shared-state");
  } else {
    availableBtn.textContent = "Location: Hidden";
    availableBtn.classList.remove("shared-state");
    availableBtn.classList.add("hidden-state");
  }

  amplitudeClient.track("availability_set", { available });

  if (lastLat && lastLon) {
    mapUI.updateMyMarker(lastLat, lastLon, isAvailable);
  }

  if (available) {
    sendLocation();
  }
}

async function sendLocation() {
  if (!isAvailable) {
    // If we just want to update the local marker, we can do it here, but watchPosition handles it.
    // Explicit sendLocation is for the SERVER.
    if (!simulateToggle.checked) {
      alert("Set availability on first");
      return;
    }
  }
  if (simulateToggle.checked) {
    const lat = parseFloat(simLat.value);
    const lon = parseFloat(simLon.value);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return alert("Enter lat/lon");
    await pushLocation(lat, lon, 5);
    // Also update local marker for simulation
    lastLat = lat;
    lastLon = lon;
    mapUI.updateMyMarker(lat, lon, isAvailable);
    return;
  }
  if (!navigator.geolocation) {
    alert("Geolocation not supported; use simulate.");
    return;
  }

  // Use cached location if available to avoid timeout
  if (lastLat && lastLon) {
    await pushLocation(lastLat, lastLon, 0);
    mapUI.updateMyMarker(lastLat, lastLon, isAvailable);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      lastLat = latitude;
      lastLon = longitude;
      await pushLocation(latitude, longitude, accuracy);
      mapUI.updateMyMarker(latitude, longitude, isAvailable);
    },
    (err) => alert(err.message),
    { enableHighAccuracy: true, timeout: 20000 },
  );
}

async function pushLocation(lat, lon, accuracy) {
  const res = await fetch("/api/location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lon, accuracy }),
  });
  if (!res.ok) {
    const err = await res.json();
    alert(err.error || "Failed to update location");
    return;
  }
  amplitudeClient.track("location_sent", { lat, lon });
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  loadPresence();
  pollTimer = setInterval(loadPresence, 5000);
}

async function loadPresence() {
  const currentUser = authUI.getUser();
  if (!currentUser) return;
  const res = await fetch("/api/presence");
  if (!res.ok) return;
  const data = await res.json();

  const presences = data.presences || [];
  renderUsers(presences);

  // Filter self from map markers (we have a custom dot now)
  const others = presences.filter(
    (u) => u.userId !== (currentUser._id || currentUser.id),
  );
  mapUI.updateMarkers(others);

  amplitudeClient.track("presence_polled");
}

function renderUsers(users) {
  const currentUser = authUI.getUser();
  // Filter out self
  const filtered = users.filter(
    (u) => !currentUser || u.userId !== (currentUser._id || currentUser.id),
  );

  if (!filtered.length) {
    usersList.innerHTML = '<div class="muted">No one else is available.</div>';
    return;
  }
  usersList.innerHTML = "";
  filtered.forEach((u) => {
    const card = document.createElement("div");
    card.className = "user-card";
    card.innerHTML = `
      <div><strong>${u.name || u.email}</strong></div>
      <div class="muted">${u.email}</div>
      <div class="actions">
        <button class="small" data-action="center">Center</button>
        <button class="small secondary" data-action="page">Page</button>
      </div>
    `;
    const [centerBtn, pageBtn] = card.querySelectorAll("button");
    centerBtn.addEventListener("click", () => {
      if (u.lat && u.lon) mapUI.centerOn(u.lat, u.lon);
    });
    pageBtn.addEventListener("click", () => pageUser(u.userId));
    usersList.appendChild(card);
  });
}

async function pageUser(toUserId) {
  const message = prompt("Optional message?") || undefined;
  const res = await fetch("/api/page", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toUserId, message }),
  });
  if (!res.ok) {
    const err = await res.json();
    alert(err.error || "Failed to send page");
    return;
  }
  const data = await res.json();
  amplitudeClient.track("page_clicked", { toUserId });
  if (data.previewUrl) {
    alert(`Sent! Ethereal preview: ${data.previewUrl}`);
  } else {
    alert("Page sent!");
  }
  suggestionsUI.fetchSuggestions();
}

bootstrap();
