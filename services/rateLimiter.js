const COOLDOWN_MS = 5 * 60 * 1000;
const lastSendMap = new Map();

function key(fromUserId, toUserId) {
  return `${fromUserId}:${toUserId}`;
}

function canSend(fromUserId, toUserId) {
  const k = key(fromUserId, toUserId);
  const last = lastSendMap.get(k);
  if (!last) return true;
  return Date.now() - last > COOLDOWN_MS;
}

function recordSend(fromUserId, toUserId) {
  lastSendMap.set(key(fromUserId, toUserId), Date.now());
}

module.exports = {
  canSend,
  recordSend,
  COOLDOWN_MS,
};
