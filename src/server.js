require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("./config/db");
const app = require("./app");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(
        `JOHNBITRACO API running on port ${PORT}`
      );
    });

    const shutdown = async () => {
      server.close(async () => {
        await mongoose.disconnect();
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();