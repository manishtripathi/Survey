const express = require("express")
const User = require("../models/User")
const Survey = require("../models/Survey")
const UserSurvey = require("../models/UserSurvey")
const authMiddleware = require("../middleware/authMiddleware")

const router = express.Router()

/**
 * GET ADMIN STATS
 */
router.get("/stats", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" })
    }

    const totalUsers = await User.countDocuments()
    const totalSurveys = await Survey.countDocuments()
    const totalAssignments = await UserSurvey.countDocuments()

    const pointsData = await User.aggregate([
      { $group: { _id: null, total: { $sum: "$points" } } }
    ])

    const totalPointsDistributed = pointsData[0]?.total || 0

    res.json({
      totalUsers,
      totalSurveys,
      totalAssignments,
      totalPointsDistributed
    })
  } catch (error) {
    console.error("Admin stats error:", error)
    res.status(500).json({ message: "Failed to fetch admin stats" })
  }
})

/**
 * PAUSE/RESUME SURVEY (ADMIN)
 */
router.patch("/survey/:surveyId/pause", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" })
    }

    const { surveyId } = req.params
    const { isPaused } = req.body

    // Validate the input
    if (isPaused === undefined) {
      return res.status(400).json({ message: "isPaused field is required" })
    }

    const newStatus = isPaused ? 'paused' : 'active'

    const survey = await Survey.findByIdAndUpdate(
      surveyId,
      { status: newStatus },
      { new: true }
    )

    if (!survey) {
      return res.status(404).json({ message: "Survey not found" })
    }

    res.json({
      message: `Survey ${newStatus} successfully`,
      survey
    })
  } catch (error) {
    console.error("Pause survey error:", error)
    res.status(500).json({ message: "Failed to update survey status" })
  }
})

module.exports = router
