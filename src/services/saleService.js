
const mongoose = require("mongoose");

const Branch = require("../models/Branch");
const Customer = require("../models/Customer");
const ProductVariant = require("../models/ProductVariant");
const { issueStock } = require("./inventoryCostService");
const StockMovement = require("../models/StockMovement");
const Sale = require("../models/Sale");
const CustomerPayment = require("../models/CustomerPayment");

const fail = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};

const createSale = async ({
  branchId,
  customerId,
  items,
  discount = 0,
  initialPayment,
  requestKey,
  notes = "",
  performedBy,
}) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const existing = await Sale.findOne({
        requestKey,
      }).session(session);

      if (existing) {
        fail("Sale request already recorded", 409);
      }

      const branch = await Branch.findById(
        branchId
      ).session(session);

      if (!branch || !branch.isActive) {
        fail("Branch unavailable", 404);
      }

      if (customerId) {
        const customer = await Customer.findById(
          customerId
        ).session(session);

        if (!customer || !customer.isActive) {
          fail("Customer unavailable", 404);
        }
      }

      const saleItems = [];
      let totalCOGS = 0;
      const seen = new Set();
      let subtotal = 0;

      for (const item of items) {
        const id = item.variantId.toLowerCase();

        if (seen.has(id)) {
          fail("Duplicate variant in sale");
        }

        seen.add(id);

        const variant = await ProductVariant
          .findById(item.variantId)
          .populate("product")
          .session(session);

        if (
          !variant ||
          !variant.isActive ||
          !variant.product ||
          !variant.product.isActive
        ) {
          fail("Product variant unavailable", 404);
        }

        const unitPrice =
          item.priceType === "wholesale"
            ? variant.wholesalePrice
            : variant.retailPrice;

        const lineTotal =
          unitPrice * item.quantity;

        if (!Number.isSafeInteger(lineTotal)) {
          fail("Sale amount exceeds safe limit");
        }

        subtotal += lineTotal;

        if (!Number.isSafeInteger(subtotal)) {
          fail("Sale total exceeds safe limit");
        }

        saleItems.push({
          variant: variant._id,
          sku: variant.sku,
          productName: variant.product.name,
          size: variant.size,
          color: variant.color,
          quantity: item.quantity,
          priceType: item.priceType,
          unitPrice,
          lineTotal,
        });
      }

      if (discount > subtotal) {
        fail("Discount exceeds subtotal");
      }

      const total = subtotal - discount;
      const amountPaid = initialPayment?.amount ?? 0;

      if (amountPaid > total) {
        fail("Payment exceeds sale total");
      }

      const balanceDue = total - amountPaid;

      if (balanceDue > 0 && !customerId) {
        fail(
          "Customer is required for credit sales"
        );
      }

      const paymentStatus =
        balanceDue === 0
          ? "paid"
          : amountPaid === 0
            ? "unpaid"
            : "partial";

      const [sale] = await Sale.create(
        [
          {
            branch: branchId,
            customer: customerId || null,
            items: saleItems,
            subtotal,
            discount,
            total,
            amountPaid,
            balanceDue,
            paymentStatus,
            requestKey,
            notes,
            createdBy: performedBy,
          },
        ],
        { session }
      );

      // Deduct each variant from the receiving branch.
      for (const item of saleItems) {
        const deduction = await issueStock({
          branchId,
          variantId: item.variant,
          quantity: item.quantity,
          performedBy,
          session,
        });
        item.costOfGoodsSold = deduction.costOfGoodsSold;
        totalCOGS += deduction.costOfGoodsSold;
        if (!Number.isSafeInteger(totalCOGS)) {
          fail("Sale COGS exceeds safe limit");
        }
        // Persist historical cost per line; no recalculation after prices change.
        const line = sale.items.find(x => x.variant.toString() === item.variant.toString());
        line.costOfGoodsSold = deduction.costOfGoodsSold;

        await StockMovement.create(
          [
            {
              branch: branchId,
              variant: item.variant,
              type: "SALE",
              quantityChange: -item.quantity,
              quantityBefore: deduction.quantityBefore,
              quantityAfter: deduction.quantityAfter,
              reason: `Sale ${sale._id}`,
              referenceType: "Sale",
              referenceId: sale._id,
              performedBy,
            },
          ],
          { session }
        );
      }

      sale.costOfGoodsSold = totalCOGS;
      sale.grossProfit = sale.total - totalCOGS;
      await sale.save({ session });

      if (amountPaid > 0) {
        await CustomerPayment.create(
          [
            {
              sale: sale._id,
              customer: customerId || null,
              branch: branchId,
              amount: amountPaid,
              method: initialPayment.method,
              reference:
                initialPayment.reference || "",
              recordedBy: performedBy,
            },
          ],
          { session }
        );
      }

      result = sale;
    });

    return result;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  createSale,
};
