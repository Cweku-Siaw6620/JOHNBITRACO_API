require("dotenv").config();

const mongoose = require("mongoose");

const User = require("../src/models/User");
const Branch = require("../src/models/Branch");

const {
  hashCredential,
} = require("../src/utils/pinUtils");

const createAdmin = async () => {
  try {
    const {
      MONGODB_URL,
      ADMIN_ID,
      ADMIN_NAME,
      ADMIN_TEMP_PASSWORD,
    } = process.env;

    if (
      !MONGODB_URL ||
      !ADMIN_ID ||
      !ADMIN_NAME ||
      !ADMIN_TEMP_PASSWORD
    ) {
      throw new Error(
        "Missing Admin setup environment variables"
      );
    }

    if (
      ADMIN_TEMP_PASSWORD.length < 12 ||
      !/[a-z]/.test(ADMIN_TEMP_PASSWORD) ||
      !/[A-Z]/.test(ADMIN_TEMP_PASSWORD) ||
      !/[0-9]/.test(ADMIN_TEMP_PASSWORD) ||
      !/[^a-zA-Z0-9]/.test(ADMIN_TEMP_PASSWORD)
    ) {
      throw new Error(
        "Temporary password must contain at least 12 characters, uppercase, lowercase, number and symbol"
      );
    }

    if (!/^[A-Za-z0-9_-]{3,30}$/.test(ADMIN_ID)) {
      throw new Error("Invalid ADMIN_ID");
    }

    await mongoose.connect(MONGODB_URL);

    await User.init();
    await Branch.init();

    const existingAdmin = await User.findOne({
      role: "admin",
    });

    if (existingAdmin) {
      console.log(
        "Admin account already exists. Setup cancelled."
      );
      return;
    }

    let mainBranch = await Branch.findOne({
      code: "MAIN",
    });

    if (!mainBranch) {
      mainBranch = await Branch.create({
        name: "Main Branch",
        code: "MAIN",
        isActive: true,
      });
    }

    const credentialHash = await hashCredential(
      ADMIN_TEMP_PASSWORD
    );

    await User.create({
      fullName: ADMIN_NAME.trim(),
      loginId: ADMIN_ID.trim().toUpperCase(),
      role: "admin",
      branch: null,
      credentialHash,
      pinLookup: null,
      mustChangePassword: true,
      isActive: true,
    });

    console.log("Main Branch ready");
    console.log("Admin account created successfully");
    console.log("Admin ID:", ADMIN_ID.toUpperCase());
    console.log("Password change required on first login");
  } catch (error) {
    console.error("Admin setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

createAdmin();