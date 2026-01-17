window.mapUI = (function () {
  const map = L.map("map", {
    zoomControl: false,
    attributionControl: false,
  }).setView([43.6532, -79.3832], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);

  const markers = new Map();

  function updateMarkers(presences) {
    const seen = new Set();
    presences.forEach((p) => {
      if (!p.lat || !p.lon) return;
      seen.add(String(p.userId));
      if (!markers.has(String(p.userId))) {
        const marker = L.marker([p.lat, p.lon]).addTo(map);
        marker.bindPopup(`<strong>${p.name || p.email}</strong>`);
        markers.set(String(p.userId), marker);
      } else {
        markers.get(String(p.userId)).setLatLng([p.lat, p.lon]);
      }
    });
    Array.from(markers.keys()).forEach((id) => {
      if (id === "me") return; // Don't remove local marker
      if (!seen.has(id)) {
        const marker = markers.get(id);
        map.removeLayer(marker);
        markers.delete(id);
      }
    });
  }

  function centerOn(lat, lon) {
    map.setView([lat, lon], 14);
  }

  function updateMyMarker(lat, lon, isSharing) {
    if (!map) return;
    const color = isSharing ? "#3b82f6" : "#64748b"; // Blue : Gray

    if (!markers.has("me")) {
      const marker = L.circleMarker([lat, lon], {
        radius: 8,
        fillColor: color,
        color: "#ffffff",
        weight: 3,
        opacity: 1,
        fillOpacity: 1,
        zIndexOffset: 1000,
      }).addTo(map);
      marker.bindPopup("<strong>You</strong>");
      markers.set("me", marker);
    } else {
      const marker = markers.get("me");
      marker.setLatLng([lat, lon]);
      marker.setStyle({ fillColor: color });
    }
  }

  return { updateMarkers, centerOn, updateMyMarker, map };
})();
