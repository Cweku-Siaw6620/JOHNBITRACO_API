const mongoose = require("mongoose");

function ghs(pesewas) {
  if (pesewas === null || pesewas === undefined) return "Unavailable";
  const sign = pesewas < 0 ? "-" : "";
  const amount = Math.abs(pesewas);
  const whole = Math.floor(amount / 100);
  const fraction = String(amount % 100).padStart(2, "0");
  return `${sign}GH₵${whole.toLocaleString("en-US")}.${fraction}`;
}

function dateUTC(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : "—";
}

function pdfSafe(value) {
  // Helvetica may not include the cedi glyph; use GHS in PDFs.
  return String(value).replaceAll("GH₵", "GHS ");
}

function getBranchId(req, supplied) {
  if (req.user.role === "admin") return supplied || null;

  const assigned = req.user.branch?._id || req.user.branch;
  if (!mongoose.isValidObjectId(assigned)) {
    const err = new Error("No assigned branch");
    err.status = 403;
    throw err;
  }

  const ownId = String(assigned);
  if (supplied && ownId.toLowerCase() !== supplied.toLowerCase()) {
    const err = new Error("Branch access denied");
    err.status = 403;
    throw err;
  }

  return ownId;
}

function dateBounds(startDate, endDate) {
  const start = startDate ? new Date(`${startDate}T00:00:00.000Z`) : null;
  const endExclusive = endDate ? new Date(`${endDate}T00:00:00.000Z`) : null;
  if (endExclusive) endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  return { start, endExclusive };
}

module.exports = { ghs, dateUTC, pdfSafe, getBranchId, dateBounds };
