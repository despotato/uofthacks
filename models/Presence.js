const mongoose = require('mongoose');

const PresenceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, index: true },
    available: { type: Boolean, default: false },
    lat: { type: Number },
    lon: { type: Number },
    accuracy: { type: Number },
  },
  { timestamps: { createdAt: false, updatedAt: 'updatedAt' } }
);

module.exports = mongoose.model('Presence', PresenceSchema);
