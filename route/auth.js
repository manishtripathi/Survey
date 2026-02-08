const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const { updateUser } = require("../controllers/userController");

const router = express.Router();

/* =========================
   SIGNUP
========================= */
router.post("/signup", async (req, res) => {
  try {
    const { name, email, phone, country, password } = req.body;

    if (!name || !email || !phone || !country || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      name,
      email,
      phone,
      country,
      password: hashedPassword,
      role: "user",
      isActive: true,
      points: 0,
    });

    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error creating user" });
  }
});

/* =========================
   LOGIN
========================= */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("LOGIN EMAIL:", email);
    console.log("INPUT PASSWORD:", password);

    const user = await User.findOne({ email });
    if (!user) {
      console.log("USER NOT FOUND");
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.isActive) {
      console.log("USER INACTIVE");
      return res.status(403).json({ message: "Account is inactive. Please contact admin" });
    }

    console.log("DB PASSWORD:", user.password);

    const isMatch = await bcrypt.compare(password, user.password);
    console.log("PASSWORD MATCH:", isMatch);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not defined in environment variables");
      return res.status(500).json({ message: "Internal server error" });
    }

    const token = jwt.sign(
      { id: user._id.toString(), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({ token, role: user.role });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

/* =========================
   PROFILE
========================= */
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: "Error fetching profile" });
  }
});

/* =========================
   ADMIN → GET USERS
========================= */
router.get("/users", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || "";

  const query = {
    $or: [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ],
  };

  const users = await User.find(query)
    .select("-password")
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ createdAt: -1 });

  const total = await User.countDocuments(query);

  res.json({
    users,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

/* =========================
   ADMIN → UPDATE USER
========================= */
router.put("/users/:id", authMiddleware, updateUser);

/* =========================
   ADMIN → ADD POINTS
========================= */
router.post("/users/:id/add-points", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }

  const { points } = req.body;
  if (!points || points <= 0) {
    return res.status(400).json({ message: "Invalid points" });
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { $inc: { points } },
    { new: true }
  ).select("-password");

  res.json({ message: "Points added", user });
});

/*=================
USER ALIVE
=================*/
router.put("/users/:id/status", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }

  const { isActive } = req.body;

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isActive },
    { new: true }
  ).select("-password");

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json({
    message: "User status updated",
    user,
  });
});


module.exports = router;
