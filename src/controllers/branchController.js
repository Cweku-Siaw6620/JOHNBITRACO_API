const mongoose = require("mongoose");

const Branch = require("../models/Branch");
const User = require("../models/User");

const getBranches = async (req, res, next) => {
  try {
    let branches;

    if (req.user.role === "admin") {
      branches = await Branch.find().sort({ name: 1 });
    } else {
      branches = await Branch.find({
        _id: req.user.branch,
        isActive: true,
      });
    }

    return res.json({
      success: true,
      count: branches.length,
      branches,
    });
  } catch (error) {
    next(error);
  }
};

const createBranch = async (req, res, next) => {
  try {
    const { name, code, location } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 100 ||
      typeof code !== "string" ||
      !/^[A-Za-z0-9_-]{2,20}$/.test(code) ||
      (location !== undefined &&
        (typeof location !== "string" ||
          location.length > 200))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch information",
      });
    }

    const branch = await Branch.create({
      name: name.trim(),
      code: code.toUpperCase(),
      location: location?.trim() || "",
    });

    return res.status(201).json({
      success: true,
      message: "Branch created successfully",
      branch,
    });
  } catch (error) {
    next(error);
  }
};

const updateBranch = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID",
      });
    }

    const branch = await Branch.findById(req.params.id);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    const allowedFields = [
      "name",
      "location",
      "isActive",
    ];

    const fields = Object.keys(req.body);

    if (
      fields.length === 0 ||
      fields.some((key) => !allowedFields.includes(key))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch update",
      });
    }

    const { name, location, isActive } = req.body;

    if (
      (name !== undefined &&
        (typeof name !== "string" ||
          !name.trim() ||
          name.length > 100)) ||
      (location !== undefined &&
        (typeof location !== "string" ||
          location.length > 200)) ||
      (isActive !== undefined &&
        typeof isActive !== "boolean")
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch values",
      });
    }

    if (
      branch.code === "MAIN" &&
      isActive === false
    ) {
      return res.status(403).json({
        success: false,
        message: "Main Branch cannot be deactivated",
      });
    }

    if (isActive === false) {
      const assignedUsers = await User.countDocuments({
        branch: branch._id,
        isActive: true,
      });

      if (assignedUsers > 0) {
        return res.status(409).json({
          success: false,
          message: "Reassign or deactivate branch staff first",
        });
      }
    }

    if (name !== undefined) {
      branch.name = name.trim();
    }

    if (location !== undefined) {
      branch.location = location.trim();
    }

    if (isActive !== undefined) {
      branch.isActive = isActive;
    }

    await branch.save();

    return res.json({
      success: true,
      message: "Branch updated successfully",
      branch,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBranches,
  createBranch,
  updateBranch,
};