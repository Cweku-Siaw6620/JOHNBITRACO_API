const BranchStock = require('../models/BranchStock');

function fail(message, status = 409) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
function checkMoney(n, name) {
  if (!Number.isSafeInteger(n) || n < 0) fail(`Invalid ${name}`, 400);
}
function checkQuantity(n) {
  if (!Number.isSafeInteger(n) || n <= 0) fail('Quantity must be a positive integer', 400);
}

// Always invoke inside the CALLER'S MongoDB transaction.
async function receiveStock({ branchId, variantId, quantity, unitCost, performedBy, session }) {
  if (!session) fail('Transaction required', 500);
  checkQuantity(quantity);
  checkMoney(unitCost, 'unit cost');
  const addedValue = quantity * unitCost;
  checkMoney(addedValue, 'received inventory value');

  let stock = await BranchStock.findOne({ branch: branchId, variant: variantId }).session(session);
  if (!stock) {
    // Unique branch/variant index protects this create under competing requests.
    const created = await BranchStock.create([{
      branch: branchId, variant: variantId, quantity: 0,
      inventoryValue: 0, updatedBy: performedBy,
    }], { session });
    stock = created[0];
  }
  if (stock.inventoryValue == null) fail('Existing stock must be cost-initialized before purchases');
  checkMoney(stock.inventoryValue, 'existing inventory value');
  const before = stock.quantity;
  const nextQty = before + quantity;
  const nextValue = stock.inventoryValue + addedValue;
  if (!Number.isSafeInteger(nextQty) || !Number.isSafeInteger(nextValue)) {
    fail('Inventory exceeds numeric limit', 400);
  }
  const updated = await BranchStock.findOneAndUpdate(
    { _id: stock._id, quantity: before, inventoryValue: stock.inventoryValue },
    { $set: { quantity: nextQty, inventoryValue: nextValue, updatedBy: performedBy } },
    { new: true, session, runValidators: true }
  );
  if (!updated) fail('Stock changed concurrently, retry transaction');
  return { stock: updated, quantityBefore: before, quantityAfter: nextQty,
    valueBefore: stock.inventoryValue, valueAfter: nextValue, valueChange: addedValue };
}

// Round cost once per sale line; final stock deduction consumes all residual value.
async function issueStock({ branchId, variantId, quantity, performedBy, session }) {
  if (!session) fail('Transaction required', 500);
  checkQuantity(quantity);
  const stock = await BranchStock.findOne({ branch: branchId, variant: variantId }).session(session);
  if (!stock || stock.quantity < quantity) fail('Insufficient stock');
  if (stock.inventoryValue == null) fail('Stock valuation missing; reconcile opening stock first');
  checkMoney(stock.inventoryValue, 'stock inventory value');
  const cost = quantity === stock.quantity
    ? stock.inventoryValue
    : Number((BigInt(stock.inventoryValue) * BigInt(quantity) + BigInt(Math.floor(stock.quantity / 2))) / BigInt(stock.quantity));
  checkMoney(cost, 'allocated cost');
  const newValue = stock.inventoryValue - cost;
  const newQty = stock.quantity - quantity;
  const updated = await BranchStock.findOneAndUpdate(
    { _id: stock._id, quantity: stock.quantity, inventoryValue: stock.inventoryValue },
    { $set: { quantity: newQty, inventoryValue: newValue, updatedBy: performedBy } },
    { new: true, session, runValidators: true }
  );
  if (!updated) fail('Stock changed concurrently, retry transaction');
  return { stock: updated, costOfGoodsSold: cost, quantityBefore: stock.quantity,
    quantityAfter: newQty, valueBefore: stock.inventoryValue, valueAfter: newValue,
    valueChange: -cost };
}
module.exports = { receiveStock, issueStock };
