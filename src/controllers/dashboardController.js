const mongoose = require("mongoose");
const { dashboardQuerySchema } = require("../validators/dashboardValidators");
const { getDashboard } = require("../services/dashboardService");

function parseDay(value) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function nextDay(value) {
  if (!value) return null;

  const date = parseDay(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

const getFinancialDashboard = async (req, res, next) => {
  try {
    const parsed = dashboardQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid dashboard filters",
        errors: parsed.error.issues,
      });
    }

    const { branchId, startDate, endDate } = parsed.data;
    let effectiveBranchId = branchId;

    if (req.user.role === "assistant") {
      const ownBranch = req.user.branch?._id || req.user.branch;

      if (!mongoose.isValidObjectId(ownBranch)) {
        return res.status(403).json({
          success: false,
          message: "No assigned branch",
        });
      }

      effectiveBranchId = String(ownBranch);

      if (branchId && branchId.toLowerCase() !== effectiveBranchId.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: "Branch access denied",
        });
      }
    }

    const dashboard = await getDashboard({
      branchId: effectiveBranchId,
      start: parseDay(startDate),
      endExclusive: nextDay(endDate),
    });

    return res.json({ success: true, dashboard });
  } catch (error) {
    next(error);
  }
};

module.exports = { getFinancialDashboard };
