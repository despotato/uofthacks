const mongoose = require('mongoose');

const PageEventSchema = new mongoose.Schema(
  {
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    message: { type: String },
    status: { type: String, enum: ['sent', 'failed'], default: 'sent' },
    error: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('PageEvent', PageEventSchema);
