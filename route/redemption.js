const express = require("express");
const router = express.Router();

const Redemption = require("../models/redemption");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

/**
 * USER → REQUEST REDEMPTION
 * Rules:
 * - Minimum 50 points
 * - Points NOT deducted here
 * - Status = pending
 */
router.post("/request", authMiddleware, async (req, res) => {
  try {
    const points = Number(req.body.points || req.body.point);

    if (isNaN(points) || points < 50) {
      return res.status(400).json({
        message: "Minimum 50 points required"
      });
    }

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (user.points < points) {
      return res.status(400).json({
        message: "Insufficient points"
      });
    }

    const existingRequest = await Redemption.findOne({
      userId: req.user.userId,
      status: "pending"
    });

    if (existingRequest) {
      return res.status(400).json({
        message: "You already have a pending redemption request"
      });
    }

    const redemption = await Redemption.create({
      userId: req.user.userId,
      points,
      status: "pending"
    });

    res.status(201).json({
      message: "Redemption request submitted",
      redemption
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * USER → FETCH REDEMPTION REQUESTS
 * - Returns all redemption requests for the authenticated user
 */
router.get("/requests", authMiddleware, async (req, res) => {
  try {
    const requests = await Redemption.find({ userId: req.user.userId }).sort({ createdAt: -1 });

    res.json({
      requests,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch redemption requests" });
  }
});

/**
 * ADMIN → LIST REDEMPTION REQUESTS
 */
router.get("/admin/requests", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const requests = await Redemption.find()
      .populate("userId", "name email points")
      .sort({ createdAt: -1 });

    res.json({ requests });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * ADMIN → REDEMPTION STATS
 */
router.get("/stats", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const total = await Redemption.countDocuments();
    const pending = await Redemption.countDocuments({ status: "pending" });
    const approved = await Redemption.countDocuments({ status: "approved" });
    const rejected = await Redemption.countDocuments({ status: "rejected" });

    res.json({
      total,
      pending,
      approved,
      rejected
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * ADMIN → APPROVE REDEMPTION
 * Points deducted ONLY here
 */
router.patch("/:id/approve", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const redemption = await Redemption.findById(req.params.id);

    if (!redemption || redemption.status !== "pending") {
      return res.status(400).json({ message: "Invalid request" });
    }

    await User.findByIdAndUpdate(
      redemption.userId,
      { $inc: { points: -redemption.points } }
    );

    redemption.status = "approved";
    await redemption.save();

    res.json({
      message: "Redemption approved",
      redemption
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * ADMIN → REJECT REDEMPTION
 */
router.patch("/:id/reject", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const redemption = await Redemption.findById(req.params.id);

    if (!redemption || redemption.status !== "pending") {
      return res.status(400).json({ message: "Invalid request" });
    }

    redemption.status = "rejected";
    await redemption.save();

    res.json({
      message: "Redemption rejected",
      redemption
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
