require("dotenv").config();

const mongoose = require("mongoose");

const app = require("./app");

const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    if (
      !process.env.PIN_LOOKUP_KEY ||
      process.env.PIN_LOOKUP_KEY.length < 64
    ) {
      throw new Error(
        "A strong PIN_LOOKUP_KEY is required"
      );
    }

    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(
        `JOHNBITRACO API running on port ${PORT}`
      );
    });

    const shutdown = async () => {
      console.log("Shutting down server...");

      server.close(async () => {
        await mongoose.disconnect();
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error(
      "Server startup failed:",
      error.message
    );

    process.exit(1);
  }
};

startServer();