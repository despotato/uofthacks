const mongoose = require('mongoose');

const SuggestionWeightSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    suggestionKey: { type: String, index: true },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    weight: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: false, updatedAt: 'updatedAt' } }
);

SuggestionWeightSchema.index({ userId: 1, suggestionKey: 1, targetUserId: 1 }, { unique: true });

module.exports = mongoose.model('SuggestionWeight', SuggestionWeightSchema);
