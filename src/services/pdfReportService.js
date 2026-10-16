const PDFDocument = require("pdfkit");
const { ghs, dateUTC, pdfSafe } = require("../utils/reportFormat");

const GOLD = "#C99A32";
const BURGUNDY = "#8B2420";
const BLACK = "#1C1C1C";

function makeDocument(res, fileName) {
  const doc = new PDFDocument({ size: "A4", margin: 44, bufferPages: true });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Cache-Control", "no-store");
  doc.on("error", err => res.destroy(err));
  doc.pipe(res);
  return doc;
}

function heading(doc, title, subtitle) {
  doc.rect(0, 0, doc.page.width, 13).fill(GOLD);
  doc.moveDown(1);
  doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(19)
    .text("JOHNBITRACO ENT.");
  doc.fillColor(BURGUNDY).font("Helvetica-Bold").fontSize(13).text(title);
  doc.fillColor("#555555").font("Helvetica").fontSize(9).text(subtitle);
  doc.moveDown(1.2);
}

function line(doc, left, right, { highlight = false } = {}) {
  if (doc.y > doc.page.height - 90) doc.addPage();
  const y = doc.y;
  doc.font(highlight ? "Helvetica-Bold" : "Helvetica")
    .fillColor(BLACK).fontSize(highlight ? 11 : 9)
    .text(left, 44, y, { width: 320 });
  doc.font(highlight ? "Helvetica-Bold" : "Helvetica")
    .text(pdfSafe(right), 365, y, { width: 185, align: "right" });
  doc.y = Math.max(doc.y, y + (highlight ? 22 : 16));
}

function section(doc, title) {
  if (doc.y > doc.page.height - 110) doc.addPage();
  doc.moveDown(0.5);
  doc.fillColor(BURGUNDY).font("Helvetica-Bold").fontSize(11).text(title);
  doc.moveDown(0.35);
}

function receiptPdf(res, sale, payments) {
  const doc = makeDocument(res, `JOHNBITRACO_receipt_${sale._id}.pdf`);
  heading(doc, "CUSTOMER SALES RECEIPT", `Sale ID: ${sale._id}`);

  line(doc, "Date", dateUTC(sale.soldAt));
  line(doc, "Branch", sale.branch?.name || "Unknown branch");
  line(doc, "Customer", sale.customer?.name || "Walk-in customer");
  line(doc, "Payment status", sale.paymentStatus.toUpperCase());

  section(doc, "Items sold");
  for (const item of sale.items) {
    const name = `${item.productName} | ${item.sku} | ${item.size} / ${item.color}`;
    if (doc.y > doc.page.height - 105) doc.addPage();
    doc.fillColor(BLACK).font("Helvetica").fontSize(9)
      .text(name, { width: 495 });
    line(doc, `${item.quantity} x ${pdfSafe(ghs(item.unitPrice))}`, ghs(item.lineTotal));
    doc.moveDown(0.2);
  }

  section(doc, "Amount due");
  line(doc, "Subtotal", ghs(sale.subtotal));
  line(doc, "Discount", ghs(sale.discount));
  line(doc, "TOTAL", ghs(sale.total), { highlight: true });
  line(doc, "Paid to date", ghs(sale.amountPaid));
  line(doc, "OUTSTANDING", ghs(sale.balanceDue), { highlight: true });

  if (payments.length) {
    section(doc, "Recorded payments");
    for (const payment of payments) {
      line(
        doc,
        `${dateUTC(payment.paidAt)} · ${payment.method.toUpperCase()}`,
        ghs(payment.amount)
      );
    }
  }

  doc.moveDown(1);
  doc.fillColor("#666666").font("Helvetica").fontSize(8)
    .text("Thank you for shopping with JOHNBITRACO ENT.");
  doc.text("This receipt shows recorded transactions. Outstanding credit remains payable.");
  doc.end();
}

function financialPdf(res, data) {
  const doc = makeDocument(res, "JOHNBITRACO_financial_report.pdf");
  const { dashboard: d, generatedAt } = data;
  const p = d.performance;
  const pay = d.paymentsInPeriod;
  const bal = d.currentBalances;
  const scope = d.scope;

  heading(
    doc,
    "FINANCIAL PERFORMANCE REPORT",
    `Generated ${dateUTC(generatedAt)} | Branch: ${scope.branchId || "All branches"} | Period: ${scope.period.startDate || "Beginning"} to ${scope.period.endDate || "Today"}`
  );

  section(doc, "Performance in selected period");
  line(doc, "Sales revenue", ghs(p.revenue));
  line(doc, "Number of sales", String(p.salesCount));
  line(doc, "Cost of goods sold", ghs(p.costOfGoodsSold));
  line(doc, "Gross profit", ghs(p.grossProfit), { highlight: true });
  line(doc, "Operating expenses", ghs(p.operatingExpenses));
  line(doc, "Operating result (indicative)", ghs(p.netOperatingResult), { highlight: true });

  section(doc, "Recorded payment activity in selected period");
  line(doc, "Customer payments received", ghs(pay.customerPaymentsReceived));
  line(doc, "Operating expenses paid", ghs(pay.operatingExpensesPaid));
  line(doc, "Net recorded payment activity", ghs(pay.netRecordedPaymentActivity));

  section(doc, "Current balances (not historical snapshots)");
  line(doc, "Customer debt", ghs(bal.customerDebt));
  line(doc, "Inventory pairs", String(bal.inventoryPairs));
  line(doc, "Inventory value", ghs(bal.inventoryValue));
  line(doc, "Low-stock variants", String(bal.lowStockVariants));

  section(doc, "Data qualifications");
  const warnings = d.warnings || [];
  warnings.forEach(warning => {
    if (doc.y > doc.page.height - 100) doc.addPage();
    doc.fillColor("#555555").font("Helvetica").fontSize(8)
      .text(`- ${pdfSafe(warning)}`, { width: 500 });
    doc.moveDown(0.35);
  });
  doc.end();
}

module.exports = { receiptPdf, financialPdf };
