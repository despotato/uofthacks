const mongoose = require('mongoose');

const SuggestionFeedbackSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    suggestionKey: { type: String, index: true },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, enum: ['accept', 'dismiss'], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('SuggestionFeedback', SuggestionFeedbackSchema);
