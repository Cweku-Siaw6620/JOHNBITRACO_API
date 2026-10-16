const ExcelJS = require("exceljs");
const { dateUTC } = require("../utils/reportFormat");

const GOLD = "C99A32";
const BLACK = "1C1C1C";
const BURGUNDY = "8B2420";

function addSheet(workbook, name, headers, rows) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = headers.map(header => ({
    header: header.label,
    key: header.key,
    width: header.width || 20,
  }));
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BLACK}` } };
  sheet.getRow(1).height = 25;
  sheet.autoFilter = { from: "A1", to: `${sheet.getColumn(headers.length).letter}1` };
  sheet.addRows(rows);

  for (const header of headers) {
    if (header.money) {
      sheet.getColumn(header.key).numFmt = '"GH₵"#,##0.00;[Red]("GH₵"#,##0.00)';
    }
  }
  sheet.eachRow((row, number) => {
    if (number > 1 && number % 2 === 0) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F3E9" } };
    }
  });
  return sheet;
}

const cedis = value => value === null || value === undefined ? null : value / 100;

async function financialExcel(res, data) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "JOHNBITRACO ENT.";
  workbook.created = new Date();

  const { dashboard: d, sales, expenses, generatedAt } = data;
  const p = d.performance;
  const balances = d.currentBalances;
  const payments = d.paymentsInPeriod;

  const summaryRows = [
    ["Generated at (UTC)", generatedAt.toISOString(), false],
    ["Branch ID", d.scope.branchId || "All branches", false],
    ["Period start", d.scope.period.startDate || "All time", false],
    ["Period end", d.scope.period.endDate || "All time", false],
    ["Sales revenue", cedis(p.revenue), true],
    ["Cost of goods sold", cedis(p.costOfGoodsSold), true],
    ["Gross profit", cedis(p.grossProfit), true],
    ["Operating expenses", cedis(p.operatingExpenses), true],
    ["Indicative operating result", cedis(p.netOperatingResult), true],
    ["Customer payments received (in period)", cedis(payments.customerPaymentsReceived), true],
    ["Net recorded payment activity", cedis(payments.netRecordedPaymentActivity), true],
    ["Customer debt (current)", cedis(balances.customerDebt), true],
    ["Inventory value (current)", cedis(balances.inventoryValue), true],
    ["Inventory pairs (current)", balances.inventoryPairs, false],
  ];

  const summary = addSheet(workbook, "Summary", [
    { label: "Metric", key: "metric", width: 47 },
    { label: "Value", key: "value", width: 30 },
  ], summaryRows.map(([metric, value]) => ({ metric, value })));
  summaryRows.forEach(([,,money], i) => {
    if (money) summary.getCell(i + 2, 2).numFmt = '"GH₵"#,##0.00;[Red]("GH₵"#,##0.00)';
  });

  addSheet(workbook, "Sales", [
    { label: "Date", key: "date", width: 15 },
    { label: "Sale ID", key: "id", width: 28 },
    { label: "Branch", key: "branch", width: 24 },
    { label: "Customer", key: "customer", width: 28 },
    { label: "Total (GHS)", key: "total", width: 20, money: true },
    { label: "Paid to date (GHS)", key: "paid", width: 22, money: true },
    { label: "Balance due (GHS)", key: "balance", width: 23, money: true },
    { label: "COGS (GHS)", key: "cogs", width: 20, money: true },
    { label: "Gross profit (GHS)", key: "profit", width: 22, money: true },
    { label: "Payment status", key: "status", width: 18 },
  ], sales.map(sale => ({
    date: dateUTC(sale.soldAt),
    id: String(sale._id),
    branch: sale.branch?.name || "",
    customer: sale.customer?.name || "Walk-in",
    total: cedis(sale.total),
    paid: cedis(sale.amountPaid),
    balance: cedis(sale.balanceDue),
    cogs: cedis(sale.costOfGoodsSold),
    profit: cedis(sale.grossProfit),
    status: sale.paymentStatus,
  })));

  addSheet(workbook, "Expenses", [
    { label: "Date", key: "date", width: 15 },
    { label: "Branch", key: "branch", width: 22 },
    { label: "Category", key: "category", width: 20 },
    { label: "Description", key: "description", width: 48 },
    { label: "Amount (GHS)", key: "amount", width: 22, money: true },
    { label: "Payment method", key: "method", width: 20 },
    { label: "Payment reference", key: "reference", width: 25 },
  ], expenses.map(expense => ({
    date: dateUTC(expense.expenseDate),
    branch: expense.branch?.name || "",
    category: expense.category,
    description: expense.description,
    amount: cedis(expense.amount),
    method: expense.paymentMethod,
    reference: expense.paymentReference,
  })));

  addSheet(workbook, "Warnings", [
    { label: "Financial data caveats", key: "warning", width: 115 },
  ], d.warnings.map(warning => ({ warning })));

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="JOHNBITRACO_financial_report.xlsx"');
  res.setHeader("Cache-Control", "no-store");
  await workbook.xlsx.write(res);
  res.end();
}

module.exports = { financialExcel };
