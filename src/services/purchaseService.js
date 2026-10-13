
const mongoose = require("mongoose");

const Branch = require("../models/Branch");
const Supplier = require("../models/Supplier");
const ProductVariant = require("../models/ProductVariant");
const BranchStock = require("../models/BranchStock");
const StockMovement = require("../models/StockMovement");
const Purchase = require("../models/Purchase");
const SupplierPayment = require("../models/SupplierPayment");

const fail = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};

const createPurchase = async ({
  supplierId,
  branchId,
  items,
  initialPayment,
  supplierInvoiceNumber = "",
  notes = "",
  requestKey,
  performedBy,
}) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      // 1. Verify receiving branch.
      const branch = await Branch.findById(
        branchId
      ).session(session);

      if (!branch || !branch.isActive) {
        fail("Receiving branch not found or inactive", 404);
      }

      // 2. Verify supplier.
      const supplier = await Supplier.findById(
        supplierId
      ).session(session);

      if (!supplier || !supplier.isActive) {
        fail("Supplier not found or inactive", 404);
      }

      // 3. Prevent duplicate purchase requests.
      const existingPurchase = await Purchase.findOne({
        requestKey,
      }).session(session);

      if (existingPurchase) {
        fail("Purchase request already recorded", 409);
      }

      // 4. Resolve variants and historical costs.
      const purchaseItems = [];
      let totalCost = 0;
      const seenVariants = new Set();

      for (const item of items) {
        const variantId = item.variantId.toString();

        if (seenVariants.has(variantId)) {
          fail("Duplicate variant in purchase items");
        }

        seenVariants.add(variantId);

        const variant = await ProductVariant.findById(
          variantId
        )
          .populate("product")
          .session(session);

        if (
          !variant ||
          !variant.isActive ||
          !variant.product ||
          !variant.product.isActive
        ) {
          fail("Invalid or inactive product variant", 404);
        }

        const lineTotal = item.quantity * item.unitCost;

        if (!Number.isSafeInteger(lineTotal)) {
          fail("Purchase line total exceeds safe limit");
        }

        totalCost += lineTotal;

        if (!Number.isSafeInteger(totalCost)) {
          fail("Purchase total exceeds safe limit");
        }

        purchaseItems.push({
          variant: variant._id,
          sku: variant.sku,
          productName: variant.product.name,
          size: variant.size,
          color: variant.color,
          quantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: lineTotal,
        });
      }

      // 5. Calculate the initial payment.
      const amountPaid = initialPayment?.amount ?? 0;
      const paymentMethod =
        amountPaid > 0 ? initialPayment.method : "none";

      if (amountPaid > totalCost) {
        fail("Initial payment cannot exceed purchase total");
      }

      const balanceDue = totalCost - amountPaid;

      const paymentStatus =
        balanceDue === 0
          ? "paid"
          : amountPaid === 0
            ? "unpaid"
            : "partial";

      // 6. Create purchase record.
      const [purchase] = await Purchase.create(
        [
          {
            supplier: supplierId,
            branch: branchId,
            items: purchaseItems,
            totalCost,
            amountPaid,
            balanceDue,
            paymentStatus,
            paymentMethod,
            supplierInvoiceNumber,
            notes,
            requestKey,
            createdBy: performedBy,
          },
        ],
        { session }
      );

      // 7. Increase receiving branch's stock.
      // Each update includes its matching movement.
      for (const item of purchaseItems) {
        const stock = await BranchStock.findOneAndUpdate(
          {
            branch: branchId,
            variant: item.variant,
          },
          {
            $inc: {
              quantity: item.quantity,
            },
            $set: {
              updatedBy: performedBy,
            },
            $setOnInsert: {
              lowStockThreshold: 5,
            },
          },
          {
            new: true,
            upsert: true,
            runValidators: true,
            session,
          }
        );

        const quantityAfter = stock.quantity;
        const quantityBefore =
          quantityAfter - item.quantity;

        await StockMovement.create(
          [
            {
              branch: branchId,
              variant: item.variant,
              type: "PURCHASE",
              quantityChange: item.quantity,
              quantityBefore,
              quantityAfter,
              reason: `Supplier purchase ${purchase._id}`,
              referenceType: "Purchase",
              referenceId: purchase._id,
              performedBy,
            },
          ],
          { session }
        );
      }

      // 8. Record the initial supplier payment.
      if (amountPaid > 0) {
        await SupplierPayment.create(
          [
            {
              purchase: purchase._id,
              supplier: supplierId,
              branch: branchId,
              amount: amountPaid,
              method: initialPayment.method,
              reference: initialPayment.reference || "",
              recordedBy: performedBy,
            },
          ],
          { session }
        );
      }

      result = purchase;
    });

    return result;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  createPurchase,
};
