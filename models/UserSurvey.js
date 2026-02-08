const mongoose = require("mongoose");

const userSurveySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  surveyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Survey",
    required: true
  },
  status: {
    type: String,
    enum: ["sent", "completed", "rewarded"],
    default: "sent"   // ✅ IMPORTANT
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  }
});

module.exports = mongoose.model("UserSurvey", userSurveySchema);
