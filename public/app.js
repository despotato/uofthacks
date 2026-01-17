const availableToggle = document.getElementById('available-toggle');
const sendLocationBtn = document.getElementById('send-location-btn');
const simulateToggle = document.getElementById('simulate-toggle');
const simulateInputs = document.getElementById('simulate-inputs');
const simLat = document.getElementById('sim-lat');
const simLon = document.getElementById('sim-lon');
const pushSimBtn = document.getElementById('push-sim-location');
const usersList = document.getElementById('users-list');

let pollTimer = null;
let isAvailable = false;

async function bootstrap() {
  await amplitudeClient.initFromServer();
  await fetchMe();
  wireEvents();
  if (authUI.getUser()) {
    startPolling();
    suggestionsUI.fetchSuggestions();
  }
}

async function fetchMe() {
  try {
    const res = await fetch('/api/me');
    if (!res.ok) return;
    const data = await res.json();
    authUI.setUser(data.user);
  } catch (err) {
    console.error(err);
  }
}

function wireEvents() {
  availableToggle.addEventListener('change', async (e) => {
    await setAvailability(e.target.checked);
  });

  sendLocationBtn.addEventListener('click', sendLocation);
  simulateToggle.addEventListener('change', (e) => {
    simulateInputs.classList.toggle('hidden', !e.target.checked);
  });
  pushSimBtn.addEventListener('click', sendLocation);

  suggestionsUI.setHandlers({
    onPage: (toUserId) => pageUser(toUserId),
    onAvailability: (available) => setAvailability(available),
  });
}

async function setAvailability(available) {
  if (!authUI.getUser()) {
    alert('Login first');
    availableToggle.checked = false;
    return;
  }
  const res = await fetch('/api/availability', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ available }),
  });
  if (!res.ok) {
    const err = await res.json();
    alert(err.error || 'Failed to update availability');
    availableToggle.checked = isAvailable;
    return;
  }
  isAvailable = available;
  amplitudeClient.track('availability_set', { available });
  if (available) {
    sendLocation();
  }
}

async function sendLocation() {
  if (!isAvailable) {
    alert('Set availability on first');
    return;
  }
  if (simulateToggle.checked) {
    const lat = parseFloat(simLat.value);
    const lon = parseFloat(simLon.value);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return alert('Enter lat/lon');
    await pushLocation(lat, lon, 5);
    return;
  }
  if (!navigator.geolocation) {
    alert('Geolocation not supported; use simulate.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      await pushLocation(latitude, longitude, accuracy);
    },
    (err) => alert(err.message),
    { enableHighAccuracy: true, timeout: 5000 }
  );
}

async function pushLocation(lat, lon, accuracy) {
  const res = await fetch('/api/location', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lon, accuracy }),
  });
  if (!res.ok) {
    const err = await res.json();
    alert(err.error || 'Failed to update location');
    return;
  }
  amplitudeClient.track('location_sent', { lat, lon });
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  loadPresence();
  pollTimer = setInterval(loadPresence, 5000);
}

async function loadPresence() {
  if (!authUI.getUser()) return;
  const res = await fetch('/api/presence');
  if (!res.ok) return;
  const data = await res.json();
  renderUsers(data.presences || []);
  mapUI.updateMarkers(data.presences || []);
  amplitudeClient.track('presence_polled');
}

function renderUsers(users) {
  if (!users.length) {
    usersList.innerHTML = '<div class="muted">No one is available yet.</div>';
    return;
  }
  usersList.innerHTML = '';
  users.forEach((u) => {
    const card = document.createElement('div');
    card.className = 'user-card';
    card.innerHTML = `
      <div><strong>${u.name || u.email}</strong></div>
      <div class="muted">${u.email}</div>
      <div class="actions">
        <button class="small" data-action="center">Center</button>
        <button class="small secondary" data-action="page">Page</button>
      </div>
    `;
    const [centerBtn, pageBtn] = card.querySelectorAll('button');
    centerBtn.addEventListener('click', () => {
      if (u.lat && u.lon) mapUI.centerOn(u.lat, u.lon);
    });
    pageBtn.addEventListener('click', () => pageUser(u.userId));
    usersList.appendChild(card);
  });
}

async function pageUser(toUserId) {
  const message = prompt('Optional message?') || undefined;
  const res = await fetch('/api/page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toUserId, message }),
  });
  if (!res.ok) {
    const err = await res.json();
    alert(err.error || 'Failed to send page');
    return;
  }
  const data = await res.json();
  amplitudeClient.track('page_clicked', { toUserId });
  if (data.previewUrl) {
    alert(`Sent! Ethereal preview: ${data.previewUrl}`);
  } else {
    alert('Page sent!');
  }
  suggestionsUI.fetchSuggestions();
}

bootstrap();
