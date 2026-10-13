const mongoose = require('mongoose');
const Branch = require('../models/Branch');
const ProductVariant = require('../models/ProductVariant');
const BranchStock = require('../models/BranchStock');
const StockMovement = require('../models/StockMovement');
const { receiveStock, issueStock } = require('./inventoryCostService');

function fail(message, status = 400) {
  const e = new Error(message); 
  e.status = status; 
  throw e; 
}

async function checkReferences(branchId, variantId, session) {
  const branch = await Branch.findById(branchId).session(session);

  if (!branch || !branch.isActive) fail('Branch not found or inactive', 404);

  const variant = await ProductVariant.findById(variantId).populate('product').session(session);

  if (!variant || !variant.isActive || !variant.product || !variant.product.isActive)
    fail('Product variant not found or inactive', 404);
}

const addOpeningStock = async ({ branchId, variantId, quantity, unitCost, lowStockThreshold = 5, reason, performedBy }) => {
  
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      await checkReferences(branchId, variantId, session);
      const existing = await BranchStock.findOne({ branch: branchId, variant: variantId }).session(session);
      if (existing) fail('Opening stock already exists for this variant and branch', 409);
      const receipt = await receiveStock({ branchId, variantId, quantity, unitCost, performedBy, session });
      receipt.stock.lowStockThreshold = lowStockThreshold;
      await receipt.stock.save({ session });
      const [movement] = await StockMovement.create([{
        branch: branchId, variant: variantId, type: 'OPENING_STOCK',
        quantityChange: quantity, quantityBefore: 0, quantityAfter: receipt.quantityAfter,
        reason, referenceType: 'OpeningStock', referenceId: receipt.stock._id, performedBy,
      }], { session });
      result = { stock: receipt.stock, movement };
    });
    return result;
  } finally { await session.endSession(); }
};
const adjustStock = async ({ branchId, variantId, quantityChange, unitCost, reason, performedBy }) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      await checkReferences(branchId, variantId, session);
      if (!Number.isSafeInteger(quantityChange) || quantityChange === 0) fail('Invalid quantity change');
      const change = quantityChange > 0
        ? await receiveStock({ branchId, variantId, quantity: quantityChange, unitCost, performedBy, session })
        : await issueStock({ branchId, variantId, quantity: -quantityChange, performedBy, session });
      const [movement] = await StockMovement.create([{
        branch: branchId, variant: variantId, type: 'ADJUSTMENT', quantityChange,
        quantityBefore: change.quantityBefore, quantityAfter: change.quantityAfter,
        reason, referenceType: 'StockAdjustment', performedBy,
      }], { session });
      result = { stock: change.stock, movement };
    });
    return result;
  } finally { await session.endSession(); }
};
module.exports = { addOpeningStock, adjustStock };
