const { init, track } = require('@amplitude/analytics-node');

let amplitudeClient = null;
let ready = false;

function initAmplitude(apiKey) {
  if (!apiKey) {
    return;
  }
  amplitudeClient = init(apiKey);
  ready = true;
}

function trackEvent(eventType, userId, eventProperties = {}) {
  if (!ready || !amplitudeClient) return;
  track({
    event_type: eventType,
    user_id: userId ? String(userId) : undefined,
    event_properties: eventProperties,
  });
}

module.exports = {
  initAmplitude,
  trackEvent,
};
