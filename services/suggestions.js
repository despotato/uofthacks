const SuggestionWeight = require('../models/SuggestionWeight');
const SuggestionFeedback = require('../models/SuggestionFeedback');
const PageEvent = require('../models/PageEvent');
const Presence = require('../models/Presence');
const User = require('../models/User');
const { trackEvent } = require('../config/amplitude');

const SUGGESTION_KEYS = {
  PAGE_NEAREST: 'PAGE_NEAREST',
  TOGGLE_ON_AT_TIME: 'TOGGLE_ON_AT_TIME',
  PAGE_FREQUENT_TARGET: 'PAGE_FREQUENT_TARGET',
  CHILL_REMINDER: 'CHILL_REMINDER',
};

function clampWeight(weight) {
  return Math.max(-10, Math.min(10, weight));
}

function timeBucket() {
  const hour = new Date().getHours();
  if (hour < 6) return 'late-night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function getWeightsByKey(userId) {
  const weights = await SuggestionWeight.find({ userId });
  const map = new Map();
  weights.forEach((w) => {
    const key = `${w.suggestionKey}:${w.targetUserId || 'any'}`;
    map.set(key, w.weight);
  });
  return map;
}

async function fetchPresenceData(userId) {
  const [selfPresence, othersPresence] = await Promise.all([
    Presence.findOne({ userId }),
    Presence.find({ available: true }).populate('userId', 'name email'),
  ]);
  return { selfPresence, othersPresence };
}

async function buildSuggestions(user) {
  const weights = await getWeightsByKey(user._id);
  const { selfPresence, othersPresence } = await fetchPresenceData(user._id);
  const bucket = timeBucket();

  const candidates = [];

  // Suggest paging nearest available friend
  if (othersPresence.length > 0 && selfPresence?.lat && selfPresence?.lon) {
    let nearest = null;
    othersPresence.forEach((p) => {
      if (String(p.userId._id) === String(user._id)) return;
      if (!p.lat || !p.lon) return;
      const distanceKm = haversineDistanceKm(selfPresence.lat, selfPresence.lon, p.lat, p.lon);
      if (!nearest || distanceKm < nearest.distanceKm) {
        nearest = { presence: p, distanceKm };
      }
    });
    if (nearest) {
      const w = weights.get(`${SUGGESTION_KEYS.PAGE_NEAREST}:${nearest.presence.userId._id}`) || 0;
      const score = 6 + w + Math.max(0, 2 - nearest.distanceKm);
      candidates.push({
        suggestionKey: SUGGESTION_KEYS.PAGE_NEAREST,
        targetUserId: nearest.presence.userId._id,
        title: `Page ${nearest.presence.userId.name || nearest.presence.userId.email}`,
        body: `They are about ${nearest.distanceKm.toFixed(1)} km away.`,
        ctaLabel: 'Send Page',
        action: { type: 'page', payload: { toUserId: nearest.presence.userId._id } },
        score,
      });
    }
  }

  // Suggest toggling availability based on time
  if (!selfPresence?.available) {
    const base = bucket === 'morning' || bucket === 'afternoon' ? 5 : 3;
    const w = weights.get(`${SUGGESTION_KEYS.TOGGLE_ON_AT_TIME}:any`) || 0;
    candidates.push({
      suggestionKey: SUGGESTION_KEYS.TOGGLE_ON_AT_TIME,
      title: 'Go Available for friends',
      body: `It is ${bucket}; flip yourself on so friends can find you.`,
      ctaLabel: 'Set Available',
      action: { type: 'availability', payload: { available: true } },
      score: base + w,
    });
  }

  // Suggest paging most frequent target
  const recentPages = await PageEvent.aggregate([
    { $match: { fromUserId: user._id } },
    { $group: { _id: '$toUserId', count: { $sum: 1 }, last: { $max: '$createdAt' } } },
    { $sort: { count: -1, last: -1 } },
    { $limit: 5 },
  ]);
  if (recentPages.length) {
    const topTarget = recentPages[0];
    const targetUser = await User.findById(topTarget._id);
    if (targetUser) {
      const w = weights.get(`${SUGGESTION_KEYS.PAGE_FREQUENT_TARGET}:${targetUser._id}`) || 0;
      candidates.push({
        suggestionKey: SUGGESTION_KEYS.PAGE_FREQUENT_TARGET,
        targetUserId: targetUser._id,
        title: `Ping ${targetUser.name || targetUser.email} again`,
        body: 'You chat often—send a quick page?',
        ctaLabel: 'Page',
        action: { type: 'page', payload: { toUserId: targetUser._id } },
        score: 4 + w + Math.min(2, topTarget.count / 3),
      });
    }
  }

  // Suggest hiding to chill
  if (selfPresence?.available) {
    const w = weights.get(`${SUGGESTION_KEYS.CHILL_REMINDER}:any`) || 0;
    candidates.push({
      suggestionKey: SUGGESTION_KEYS.CHILL_REMINDER,
      title: 'Take a breather',
      body: 'Set yourself to hidden for a bit.',
      ctaLabel: 'Go Hidden',
      action: { type: 'availability', payload: { available: false } },
      score: 2 + w + (bucket === 'evening' ? 1 : 0),
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const trimmed = candidates.slice(0, Math.max(2, Math.min(4, candidates.length)));
  return trimmed.map((c, idx) => ({
    id: `${c.suggestionKey}-${c.targetUserId || idx}`,
    suggestionKey: c.suggestionKey,
    targetUserId: c.targetUserId,
    title: c.title,
    body: c.body,
    ctaLabel: c.ctaLabel,
    action: c.action,
  }));
}

async function recordFeedback({ userId, suggestionKey, targetUserId, action }) {
  const delta = action === 'accept' ? 2 : -2;
  const record = await SuggestionFeedback.create({ userId, suggestionKey, targetUserId, action });
  const update = await SuggestionWeight.findOneAndUpdate(
    { userId, suggestionKey, targetUserId },
    {
      $setOnInsert: { weight: 0 },
      $inc: { weight: delta },
    },
    { new: true, upsert: true }
  );
  update.weight = clampWeight(update.weight);
  await update.save();
  trackEvent('suggestion_weight_updated', userId, {
    suggestionKey,
    targetUserId,
    action,
    weight: update.weight,
  });
  return { record, weight: update.weight };
}

module.exports = {
  SUGGESTION_KEYS,
  buildSuggestions,
  recordFeedback,
};
