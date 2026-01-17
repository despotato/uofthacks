const Presence = require('../models/Presence');

/**
 * Update a user's live location. Assumes availability already enforced upstream.
 * Returns the updated Presence document.
 */
async function updateLiveLocation(userId, { lat, lon, accuracy }) {
  const presence = await Presence.findOne({ userId });
  if (!presence || !presence.available) {
    throw new Error('Set available before sending location');
  }
  presence.lat = lat;
  presence.lon = lon;
  presence.accuracy = accuracy;
  await presence.save();
  return presence;
}

module.exports = { updateLiveLocation };
