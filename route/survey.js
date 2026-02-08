const express = require("express");
const mongoose = require("mongoose");
const Survey = require("../models/Survey");
const UserSurvey = require("../models/UserSurvey");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();



/**
 * GET ALL SURVEYS
 */
router.get("/all", authMiddleware, async (req, res) => {
  try {
    const { search = "", page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);

    // Build search query
    let query = {};
    if (search) {
      query = {
        $or: [
          { title: { $regex: search, $options: "i" } },
          { surveyLink: { $regex: search, $options: "i" } }
        ]
      };
    }

    // Get total count
    const total = await Survey.countDocuments(query);
    const pages = Math.ceil(total / pageSize);

    // Fetch surveys with pagination
    const surveys = await Survey.find(query)
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .sort({ createdAt: -1 })
      .select("_id title surveyLink rewardPoints status startDate endDate")
      .lean(); // Convert to plain JavaScript objects

    // Check if each survey is assigned to any user
    const surveyIds = surveys.map(survey => survey._id);
    const assignments = await UserSurvey.find({ surveyId: { $in: surveyIds } });

    const surveysWithAssignmentStatus = surveys.map(survey => {
      const isAssigned = assignments.some(
        assignment => assignment.surveyId.toString() === survey._id.toString()
      );
      return { ...survey, isAssigned };
    });

    res.json({ surveys: surveysWithAssignmentStatus, pages, total });
  } catch (error) {
    // console.error("Fetch surveys error:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET SURVEYS ASSIGNED TO CURRENT USER
 */
router.get("/assigned", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const userSurveys = await UserSurvey.find({
      userId: new mongoose.Types.ObjectId(userId)
    });

    if (!userSurveys || userSurveys.length === 0) {
      return res.json({ surveys: [] });
    }

    const surveyIds = userSurveys.map(us => us.surveyId);

    const surveys = await Survey.find({
      _id: { $in: surveyIds },
      status: { $ne: "paused" }
    }).select("_id title surveyLink rewardPoints status startDate endDate");

    const assignedSurveys = surveys.map(survey => {
      const assignment = userSurveys.find(
        us => us.surveyId.toString() === survey._id.toString()
      );

      return {
        ...survey.toObject(),
        assignmentStatus: assignment?.status || "sent"
      };
    });

    res.json({ surveys: assignedSurveys });
  } catch (error) {
    //console.error("Fetch assigned surveys error:", error);
    res.status(500).json({ message: error.message });
  }
});


/**
 * UPDATE SURVEY (ADMIN)
 */
router.patch("/:surveyId", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { surveyId } = req.params;
    const { title, surveyLink, rewardPoints, startDate, endDate } = req.body;

   // console.log("Request body:", req.body);
    console.log("Survey ID:", surveyId);

    // Validate dates if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start >= end) {
        return res.status(400).json({ message: "End date must be after start date" });
      }
    }

    // Validate reward points if provided
    if (rewardPoints !== undefined && (isNaN(rewardPoints) || rewardPoints < 1)) {
      return res.status(400).json({ message: "Reward points must be a positive number" });
    }

    const updateData = {};
    if (title) updateData.title = title;
    if (surveyLink) updateData.surveyLink = surveyLink;
    if (rewardPoints) updateData.rewardPoints = parseInt(rewardPoints);
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);

    const survey = await Survey.findByIdAndUpdate(
      surveyId,
      updateData,
      { new: true }
    );

    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    res.json({
      message: "Survey updated successfully",
      survey
    });
  } catch (error) {
    //console.error("Update survey error:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET USERS ASSIGNED TO A SURVEY
 */
router.get("/:surveyId/users", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { surveyId } = req.params;

    // Find all users assigned to this survey
    const userSurveys = await UserSurvey.find({ surveyId });

    if (!userSurveys || userSurveys.length === 0) {
      return res.json({ users: [] });
    }

    // Get user details for each assignment
    const userIds = userSurveys.map(us => us.userId);
    const users = await User.find({ _id: { $in: userIds } }).select('name email');

    // Combine user data with assignment status
    const assignedUsers = users.map(user => {
      const assignment = userSurveys.find(us => us.userId.toString() === user._id.toString());
      return {
        ...user.toObject(),
        assignmentStatus: assignment?.status || 'sent'
      };
    });

    res.json({ users: assignedUsers });
  } catch (error) {
    console.error("Fetch survey users error:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * CREATE SURVEY (ADMIN)
 */
router.post("/create", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { title, surveyLink, rewardPoints, startDate, endDate } = req.body;

    // Validate dates
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Start date and end date are required" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return res.status(400).json({ message: "End date must be after start date" });
    }

    const survey = new Survey({
      title,
      surveyLink,
      rewardPoints,
      startDate: start,
      endDate: end,
      status: 'active'
    });

    await survey.save();

    res.status(201).json({
      message: "Survey created successfully",
      survey
    });
  } catch (error) {
    //console.error("Create survey error:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * ASSIGN SURVEY TO USER (ADMIN)
 */
router.post("/assign", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { userId, surveyId } = req.body;

    const existing = await UserSurvey.findOne({
       userId:new mongoose.Types.ObjectId(userId),
       surveyId:new mongoose.Types.ObjectId(surveyId)
       });
    if (existing) {
      return res.status(400).json({ message: "Survey already assigned to this user" });
    }

    const assignment = new UserSurvey({
      userId:new mongoose.Types.ObjectId(userId),
      surveyId:new mongoose.Types.ObjectId(surveyId),
      status: "sent"
    });

    await assignment.save();
    assignment.push(assignment);

    res.status(201).json({
      message: "Survey assigned to user successfully",
      assignment
    });
  } catch (error) {
    //console.error("Assign survey error:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * ASSIGN SURVEY TO MULTIPLE USERS (ADMIN)
 */
router.post("/assign-multiple", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { userIds, surveyId } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: "User IDs must be a non-empty array" });
    }

    if (!surveyId) {
      return res.status(400).json({ message: "Survey ID is required" });
    }

    const assignments = [];
    const skipped = [];

    for (const userId of userIds) {
      const existing = await UserSurvey.findOne({ userId, surveyId });
      if (existing) {
        skipped.push(userId);
        continue;
      }

      const assignment = new UserSurvey({
        userId,
        surveyId,
        status: "sent"
      });

      await assignment.save();
      assignments.push(assignment);
    }

    res.status(201).json({
      message: `Survey assigned to ${assignments.length} user(s) successfully`,
      assignedCount: assignments.length,
      skippedCount: skipped.length,
      assignments
    });
  } catch (error) {
   // console.error("Assign survey to multiple users error:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * Assigned add points (ADMIN)
 */
router.post("/add-points", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { userId, surveyId, points } = req.body;

    if (!userId || !surveyId || !points) {
      return res.status(400).json({
        message: "User ID, survey ID and points are required"
      });
    }

    const assignment = await UserSurvey.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      surveyId: new mongoose.Types.ObjectId(surveyId)
    });

    if (!assignment) {
      return res.status(404).json({
        message: "Survey not assigned to user"
      });
    }

    if (assignment.status === "rewarded") {
      return res.status(400).json({
        message: "Points already added for this survey"
      });
    }

    // Add points ONCE
    await User.findByIdAndUpdate(userId, {
      $inc: { points: Number(points) }
    });

    // Mark rewarded
    assignment.status = "rewarded";
    assignment.rewardedAt = new Date();
    await assignment.save();

    res.json({ message: "Points added successfully" });
  } catch (err) {
    //console.error("Add points error:", err);
    res.status(500).json({ message: err.message });
  }
});


/**
 * Survey complete (USER)
 */
router.get("/completed", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;

   // console.log("Fetching completed surveys for userId:", userId);

    const completedSurveys = await UserSurvey.find({
      userId,
      status: "rewarded"
    })
      .populate("surveyId")
      .sort({ rewardedAt: -1 });

    //console.log("Completed Surveys Query Result:", completedSurveys);

    const result = completedSurveys.map((assignment) => ({
      surveyId: assignment.surveyId._id,
      title: assignment.surveyId.title,
      points: assignment.surveyId.rewardPoints,
      rewardedAt: assignment.rewardedAt
    }));

    res.json({ surveys: result });
  } catch (err) {
    //console.error("Fetch completed surveys error:", err);
    res.status(500).json({ message: err.message });
  }
});


/** Complete Survey (USER) */
router.post("/complete", authMiddleware, async (req, res) => {
  try {
    const { surveyId } = req.body;
    const userId = req.user._id;

    if (!surveyId) {
      return res.status(400).json({ message: "Survey ID is required" });
    }

    const userSurvey = await UserSurvey.findOne({ userId, surveyId });
    if (!userSurvey) {
      return res.status(404).json({ message: "Survey not assigned to user" });
    }

    if (userSurvey.status === "rewarded") {
      return res.status(400).json({ message: "Reward already credited" });
    }

    const survey = await Survey.findById(surveyId);
    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    await User.findByIdAndUpdate(
      userId,
      { $inc: { points: survey.rewardPoints } }
    );

    userSurvey.status = "rewarded";
    await userSurvey.save();

    res.json({
      message: "Survey completed and points credited",
      pointsAdded: survey.rewardPoints
    });
  } catch (error) {
    // console.error("Complete survey error:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * PAUSE SURVEY (ADMIN)
 */
router.patch("/pause/:surveyId", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { surveyId } = req.params;
    console.log("Pause Survey - Survey ID:", surveyId); // Log surveyId for debugging
    console.log("User Role:", req.user.role); // Log user role for debugging

    const survey = await Survey.findByIdAndUpdate(
      surveyId,
      { status: 'paused', active: false },
      { new: true }
    );

    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    res.json({
      message: "Survey paused successfully",
      survey
    });
  } catch (error) {
    console.error("Pause survey error:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * RESUME SURVEY (ADMIN)
 */
router.patch("/resume/:surveyId", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { surveyId } = req.params;
    const now = new Date();

    const survey = await Survey.findById(surveyId);
    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    // Check if survey has expired
    if (now > survey.endDate) {
      return res.status(400).json({ message: "Cannot resume an expired survey" });
    }

    const updatedSurvey = await Survey.findByIdAndUpdate(
      surveyId,
      { status: 'active', active: true },
      { new: true }
    );

    res.json({
      message: "Survey resumed successfully",
      survey: updatedSurvey
    });
  } catch (error) {
    // console.error("Resume survey error:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * CHECK SURVEY STATUS AND EXPIRE SURVEYS
 */
router.patch("/check-expiry/:surveyId", authMiddleware, async (req, res) => {
  try {
    const { surveyId } = req.params;
    const now = new Date();

    const survey = await Survey.findById(surveyId);
    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    // Check if survey has expired
    if (now > survey.endDate && survey.status !== 'expired') {
      await Survey.findByIdAndUpdate(
        surveyId,
        { status: 'expired', active: false },
        { new: true }
      );
    }

    res.json({
      message: "Survey status checked",
      survey: await Survey.findById(surveyId)
    });
  } catch (error) {
    // console.error("Check expiry error:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/survey/admin/stats
 * Returns survey statistics for the admin
 */
router.get("/admin/stats", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const totalSurveys = await Survey.countDocuments();
    const totalAssignments = await UserSurvey.countDocuments();
    const totalPointsDistributed = await UserSurvey.aggregate([
      { $group: { _id: null, totalPoints: { $sum: "$rewardPoints" } } },
    ]);
    const totalUsers = await User.countDocuments({ isActive: true }); // Count active users

    res.json({
      totalSurveys,
      totalAssignments,
      totalPointsDistributed: totalPointsDistributed[0]?.totalPoints || 0,
      totalUsers, // Include totalUsers in the response
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch survey stats" });
  }
});

/**
 * GET SURVEYS FOR DROPDOWN
 */
router.get("/dropdown", authMiddleware, async (req, res) => {
  try {
    const surveys = await Survey.find({})
      .select("_id title rewardPoints"); // Fetch only necessary fields

    res.json(surveys);
  } catch (error) {
    // console.error("Error fetching surveys for dropdown:", error);
    res.status(500).json({ message: "Failed to fetch surveys." });
  }
});

/**
 * assigned-for-points - Get total points from assigned surveys for a user
 */
router.get("/assigned-for-points", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    

    const assignments = await UserSurvey.find({
      userId: new mongoose.Types.ObjectId(userId),
      status: { $ne: "rewarded" }
    }).populate("surveyId");

    const surveys = assignments.map(a => ({
      _id: a.surveyId._id,
      title: a.surveyId.title,
      rewardPoints: a.surveyId.rewardPoints,
      assignmentStatus: a.status
    }));

    res.json({ surveys });
  } catch (error) {
    // console.error("assigned-for-points error:", error);
    res.status(500).json({ message: error.message });
  }
});



module.exports = router;
