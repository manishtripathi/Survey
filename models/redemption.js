const mongoose = require("mongoose");

const redemptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  points: {
    type: Number,
    required: true
  },
  assignedSurvey: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Survey",
    required: false // Optional field for assigned surveys
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Redemption", redemptionSchema);
