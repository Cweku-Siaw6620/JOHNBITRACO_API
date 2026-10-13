const mongoose = require('mongoose');

const safeNonnegative = { type: Number, min: 0, validate: Number.isSafeInteger };

const branchStockSchema = new mongoose.Schema({
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  variant: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
  quantity: { ...safeNonnegative, required: true, default: 0 },
  lowStockThreshold: { ...safeNonnegative, default: 5 },
  
  // Null = cost not established. Never interpret legacy stock as zero-cost inventory.
  inventoryValue: { ...safeNonnegative, default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });
branchStockSchema.index({ branch: 1, variant: 1 }, { unique: true });
branchStockSchema.index({ branch: 1, quantity: 1 });
module.exports = mongoose.model('BranchStock', branchStockSchema);
