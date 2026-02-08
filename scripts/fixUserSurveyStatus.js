const mongoose = require("mongoose");
const UserSurvey = require("../models/UserSurvey");
require("dotenv").config(); // Load environment variables from .env file

const MONGO_URI = process.env.MONGODB_URI; // Use environment variable for MongoDB connection string

const fixUserSurveyStatus = async () => {
  try {
    await mongoose.connect(MONGO_URI); // Removed deprecated options

    console.log("Connected to MongoDB");

    // Find and update records missing the status field
    const result = await UserSurvey.updateMany(
      { status: { $exists: false } },
      { $set: { status: "sent" } }
    );

    console.log(
      `${result.modifiedCount} UserSurvey records updated with default status.`
    );
  } catch (error) {
    console.error("Error fixing UserSurvey status:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

fixUserSurveyStatus();