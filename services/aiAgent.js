const Presence = require('../models/Presence');
const PageEvent = require('../models/PageEvent');
const User = require('../models/User');

/**
 * Collects context the AI agent could use to decide paging actions.
 */
async function buildPagingContext(userId) {
  const [selfPresence, availablePresences, recentPages] = await Promise.all([
    Presence.findOne({ userId }),
    Presence.find({ available: true }).populate('userId', 'name email'),
    PageEvent.find({ fromUserId: userId }).sort({ createdAt: -1 }).limit(10),
  ]);

  const others = availablePresences.filter((p) => String(p.userId._id) !== String(userId));

  return {
    selfPresence,
    availableUsers: others.map((p) => ({
      userId: p.userId._id,
      name: p.userId.name,
      email: p.userId.email,
      lat: p.lat,
      lon: p.lon,
      updatedAt: p.updatedAt,
    })),
    recentPages: recentPages.map((e) => ({
      toUserId: e.toUserId,
      message: e.message,
      status: e.status,
      createdAt: e.createdAt,
    })),
    timeOfDay: new Date().getHours(),
  };
}

/**
 * Placeholder decision function: callers can swap this for an AI call.
 * Returns a suggested user to page and the reason.
 */
function decidePagingFromContext(context) {
  const { availableUsers, selfPresence, timeOfDay } = context;
  if (!selfPresence || !selfPresence.available || !availableUsers.length) {
    return { shouldPage: false, reason: 'Not available or no peers' };
  }
  // Simple heuristic; replace with AI scoring as needed.
  const target = availableUsers[0];
  return {
    shouldPage: true,
    targetUserId: target.userId,
    reason: `First available peer at hour ${timeOfDay}`,
    decisionSource: 'rule',
  };
}

module.exports = {
  buildPagingContext,
  decidePagingFromContext,
};
