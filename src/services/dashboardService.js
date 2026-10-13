const mongoose = require("mongoose");

const Sale = require("../models/Sale");
const Purchase = require("../models/Purchase");
const Expense = require("../models/Expense");
const BranchStock = require("../models/BranchStock");
const CustomerPayment = require("../models/CustomerPayment");
const SupplierPayment = require("../models/SupplierPayment");

function sumField(field) {
  return { $sum: `$${field}` };
}

function dateFilter(field, start, endExclusive) {
  if (!start && !endExclusive) return {};

  return {
    [field]: {
      ...(start ? { $gte: start } : {}),
      ...(endExclusive ? { $lt: endExclusive } : {}),
    },
  };
}

async function aggregateOne(Model, match, projection) {
  const rows = await Model.aggregate([
    { $match: match },
    { $group: { _id: null, count: { $sum: 1 }, ...projection } },
  ]);

  return rows[0] || { count: 0 };
}

function getBranchFilter(branchId) {
  return branchId
    ? { branch: new mongoose.Types.ObjectId(branchId) }
    : {};
}

function dayBucket(field) {
  return {
    $dateToString: {
      format: "%Y-%m-%d",
      date: `$${field}`,
      timezone: "UTC",
    },
  };
}

async function getDashboard({ branchId, start, endExclusive }) {
  const branch = getBranchFilter(branchId);

  const salesMatch = {
    ...branch,
    ...dateFilter("soldAt", start, endExclusive),
  };

  const purchaseMatch = {
    ...branch,
    ...dateFilter("purchasedAt", start, endExclusive),
  };

  const expenseMatch = {
    ...branch,
    status: "posted",
    ...dateFilter("expenseDate", start, endExclusive),
  };

  const customerPaymentMatch = {
    ...branch,
    ...dateFilter("paidAt", start, endExclusive),
  };

  const supplierPaymentMatch = {
    ...branch,
    ...dateFilter("paidAt", start, endExclusive),
  };

  // Debts and inventory below are CURRENT balances, not historical snapshots.
  const [
    saleTotals,
    missingCostSales,
    purchaseTotals,
    expenseTotals,
    customerCash,
    supplierCash,
    customerDebt,
    supplierDebt,
    stockTotals,
    missingValuation,
    lowStock,
    dailySales,
    categoryExpenses,
  ] = await Promise.all([
    aggregateOne(Sale, salesMatch, {
      revenue: sumField("total"),
      costOfGoodsSold: { $sum: { $ifNull: ["$costOfGoodsSold", 0] } },
    }),

    Sale.countDocuments({
      ...salesMatch,
      $or: [
        { costOfGoodsSold: null },
        { grossProfit: null },
      ],
    }),

    aggregateOne(Purchase, purchaseMatch, {
      purchaseValue: sumField("totalCost"),
    }),

    aggregateOne(Expense, expenseMatch, {
      operatingExpenses: sumField("amount"),
    }),

    aggregateOne(CustomerPayment, customerPaymentMatch, {
      cashReceived: sumField("amount"),
    }),

    aggregateOne(SupplierPayment, supplierPaymentMatch, {
      supplierPayments: sumField("amount"),
    }),

    aggregateOne(Sale, { ...branch, balanceDue: { $gt: 0 } }, {
      outstandingReceivables: sumField("balanceDue"),
    }),

    aggregateOne(Purchase, { ...branch, balanceDue: { $gt: 0 } }, {
      outstandingPayables: sumField("balanceDue"),
    }),

    aggregateOne(BranchStock, branch, {
      totalPairs: sumField("quantity"),
      knownInventoryValue: {
        $sum: { $ifNull: ["$inventoryValue", 0] },
      },
    }),

    BranchStock.countDocuments({
      ...branch,
      quantity: { $gt: 0 },
      inventoryValue: null,
    }),

    BranchStock.countDocuments({
      ...branch,
      $expr: { $lte: ["$quantity", "$lowStockThreshold"] },
    }),

    Sale.aggregate([
      { $match: salesMatch },
      { $group: {
        _id: dayBucket("soldAt"),
        revenue: sumField("total"),
        salesCount: { $sum: 1 },
      } },
      { $sort: { _id: 1 } },
    ]),

    Expense.aggregate([
      { $match: expenseMatch },
      { $group: {
        _id: "$category",
        amount: sumField("amount"),
        count: { $sum: 1 },
      } },
      { $sort: { amount: -1 } },
    ]),
  ]);

  const revenue = saleTotals.revenue || 0;
  const cogs = saleTotals.costOfGoodsSold || 0;
  const expenses = expenseTotals.operatingExpenses || 0;
  const profitsComplete = missingCostSales === 0;
  const valuationComplete = missingValuation === 0;

  return {
    scope: {
      branchId: branchId || null,
      period: {
        startDate: start ? start.toISOString().slice(0, 10) : null,
        endDate: endExclusive
          ? new Date(endExclusive.getTime() - 1).toISOString().slice(0, 10)
          : null,
      },
    },
    performance: {
      revenue,
      salesCount: saleTotals.count,
      purchasesValue: purchaseTotals.purchaseValue || 0,
      purchasesCount: purchaseTotals.count,
      operatingExpenses: expenses,
      expenseCount: expenseTotals.count,
      costOfGoodsSold: profitsComplete ? cogs : null,
      grossProfit: profitsComplete ? revenue - cogs : null,
      netOperatingResult: profitsComplete ? revenue - cogs - expenses : null,
      profitAvailable: profitsComplete,
      uncostedSales: missingCostSales,
    },
    paymentsInPeriod: {
      customerPaymentsReceived: customerCash.cashReceived || 0,
      supplierPaymentsMade: supplierCash.supplierPayments || 0,
      operatingExpensesPaid: expenses,
      // This is an activity subtotal, not a reconciled bank/cash balance.
      netRecordedPaymentActivity:
        (customerCash.cashReceived || 0) -
        (supplierCash.supplierPayments || 0) - expenses,
    },
    currentBalances: {
      customerDebt: customerDebt.outstandingReceivables || 0,
      supplierDebt: supplierDebt.outstandingPayables || 0,
      inventoryPairs: stockTotals.totalPairs || 0,
      inventoryValue: valuationComplete
        ? (stockTotals.knownInventoryValue || 0)
        : null,
      inventoryValuationComplete: valuationComplete,
      unvaluedStockRecords: missingValuation,
      lowStockVariants: lowStock,
    },
    charts: {
      dailySales: dailySales.map(row => ({
        date: row._id,
        revenue: row.revenue,
        salesCount: row.salesCount,
      })),
      expensesByCategory: categoryExpenses.map(row => ({
        category: row._id,
        amount: row.amount,
        count: row.count,
      })),
    },
    warnings: [
      ...(profitsComplete ? [] : [
        `${missingCostSales} sale(s) lack historical cost data; profit figures are unavailable.`,
      ]),
      ...(valuationComplete ? [] : [
        `${missingValuation} positive-stock record(s) require cost reconciliation.`,
      ]),
      "Current debts and inventory are present-day balances, not balances as of the selected reporting end date.",
      "Payment activity is not a reconciled cash or bank balance and excludes refunds and transfers.",
      "Returns are not yet implemented; figures must be reconciled if historical returns exist.",
    ],
  };
}

module.exports = { getDashboard };
