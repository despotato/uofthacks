const express = require('express');
const { z } = require('zod');
const Presence = require('../models/Presence');
const PageEvent = require('../models/PageEvent');
const User = require('../models/User');
const { buildSuggestions, recordFeedback } = require('../services/suggestions');
const { sendPageEmail } = require('../services/mailer');
const { canSend, recordSend, COOLDOWN_MS } = require('../services/rateLimiter');
const { trackEvent } = require('../config/amplitude');
const { updateLiveLocation } = require('../services/locationTracker');

function apiRouter({ mailConfig, amplitudeKeyPublic }) {
  const router = express.Router();

  const requireAuth = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    next();
  };

  router.get('/api/me', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    res.json({ user: req.user });
  });

  router.get('/api/config', (req, res) => {
    res.json({ amplitudeKey: amplitudeKeyPublic || null });
  });

  router.post('/api/availability', requireAuth, async (req, res, next) => {
    const schema = z.object({ available: z.boolean() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const { available } = parsed.data;
    try {
      const presence = await Presence.findOneAndUpdate(
        { userId: req.user._id },
        { available, ...(available ? {} : { lat: null, lon: null, accuracy: null }) },
        { upsert: true, new: true }
      );
      trackEvent('presence_updated', req.user._id, { available });
      res.json({ presence });
    } catch (err) {
      next(err);
    }
  });

  router.post('/api/location', requireAuth, async (req, res, next) => {
    const schema = z.object({
      lat: z.number(),
      lon: z.number(),
      accuracy: z.number().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const { lat, lon, accuracy } = parsed.data;
    try {
      await updateLiveLocation(req.user._id, { lat, lon, accuracy });
      trackEvent('presence_updated', req.user._id, { available: true, lat, lon });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.get('/api/presence', requireAuth, async (req, res, next) => {
    try {
      const presences = await Presence.find({ available: true }).populate('userId', 'name email');
      const filtered = presences
        .filter((p) => p.userId)
        .map((p) => ({
          userId: p.userId._id,
          name: p.userId.name,
          email: p.userId.email,
          lat: p.lat,
          lon: p.lon,
          updatedAt: p.updatedAt,
        }));
      res.json({ presences: filtered });
    } catch (err) {
      next(err);
    }
  });

  router.post('/api/page', requireAuth, async (req, res, next) => {
    const schema = z.object({
      toUserId: z.string(),
      message: z.string().max(500).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const { toUserId, message } = parsed.data;
    if (String(toUserId) === String(req.user._id)) return res.status(400).json({ error: 'Cannot page yourself' });
    try {
      const targetUser = await User.findById(toUserId);
      if (!targetUser) return res.status(404).json({ error: 'Recipient not found' });

      const latest = await PageEvent.findOne({ fromUserId: req.user._id, toUserId }).sort({ createdAt: -1 });
      const now = Date.now();
      if (latest && now - latest.createdAt.getTime() < COOLDOWN_MS) {
        const retrySec = Math.ceil((COOLDOWN_MS - (now - latest.createdAt.getTime())) / 1000);
        return res.status(429).json({ error: `Cooldown active. Try again in ${retrySec}s` });
      }
      if (!canSend(req.user._id, toUserId)) {
        return res.status(429).json({ error: 'Cooldown active' });
      }

      let status = 'sent';
      let errorMessage = null;
      let previewUrl = null;

      try {
        const result = await sendPageEmail(
          {
            toEmail: targetUser.email,
            fromEmail: mailConfig.defaultFrom,
            fromName: req.user.name || req.user.email,
            message,
          },
          mailConfig.smtp
        );
        previewUrl = result.previewUrl;
      } catch (err) {
        status = 'failed';
        errorMessage = err.message;
      }

      const event = await PageEvent.create({
        fromUserId: req.user._id,
        toUserId,
        message,
        status,
        error: errorMessage,
      });
      if (status === 'sent') {
        recordSend(req.user._id, toUserId);
        trackEvent('page_sent', req.user._id, { toUserId });
      } else {
        trackEvent('page_failed', req.user._id, { toUserId, error: errorMessage });
      }
      res.json({ status, previewUrl, event });
    } catch (err) {
      next(err);
    }
  });

  router.get('/api/suggestions', requireAuth, async (req, res, next) => {
    try {
      const suggestions = await buildSuggestions(req.user);
      suggestions.forEach((s) => trackEvent('suggestion_shown', req.user._id, { suggestionKey: s.suggestionKey }));
      res.json({ suggestions });
    } catch (err) {
      next(err);
    }
  });

  router.post('/api/suggestions/feedback', requireAuth, async (req, res, next) => {
    const schema = z.object({
      suggestionKey: z.string(),
      targetUserId: z.string().optional(),
      action: z.enum(['accept', 'dismiss']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const { suggestionKey, targetUserId, action } = parsed.data;
    try {
      const result = await recordFeedback({
        userId: req.user._id,
        suggestionKey,
        targetUserId,
        action,
      });
      trackEvent('suggestion_feedback', req.user._id, { suggestionKey, action });
      res.json({ ok: true, weight: result.weight });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = apiRouter;
