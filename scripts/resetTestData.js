const mongoose = require("mongoose");
require("dotenv").config();

const User = require("../models/User");
const UserSurvey = require("../models/UserSurvey");

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    await UserSurvey.deleteMany({});
    await User.updateMany(
      { role: { $ne: "admin" } },
      { $set: { points: 0 } }
    );

    console.log("✅ Test data reset complete");
    process.exit();
  } catch (err) {
    console.error("❌ Reset failed:", err);
    process.exit(1);
  }
})();
