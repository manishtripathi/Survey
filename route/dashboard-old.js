const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const UserSurvey = require("../models/UserSurvey");

console.log("🔥 dashboard.js loaded");


const router = express.Router();

router.get("/surveys", authMiddleware, async (req, res) => {
  try {
    console.log("Fetching surveys for user:", req.user.userId);
    const surveys = await UserSurvey.find({
      userId: req.user.userId
    }).populate("surveyId");

    res.json({
      message: "Assigned surveys fetched",
      surveys
    });
  } catch (error) {
    console.error("Dashboard surveys error:", error);
    res.status(500).json({ message: error.message });
  }
});

router.get("/alive", (req, res) => {
  res.send("dashboard router alive");
});

module.exports = router;
