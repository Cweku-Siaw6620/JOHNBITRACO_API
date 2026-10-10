const mongoose = require("mongoose");

const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URL;

  if (!mongoURI) {
    throw new Error("MONGODB_URL is missing");
  }

  await mongoose.connect(mongoURI);

  await Promise.all([
    require("../models/User").init(),
    require("../models/Session").init(),
    require("../models/Branch").init(),
  ]);

  console.log("MongoDB connected successfully");
};

module.exports = connectDB;