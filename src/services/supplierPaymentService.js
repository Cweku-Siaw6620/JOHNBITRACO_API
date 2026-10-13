
const mongoose = require("mongoose");

const Purchase = require("../models/Purchase");
const SupplierPayment = require("../models/SupplierPayment");

const fail = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};

const recordSupplierRepayment = async ({
  purchaseId,
  amount,
  method,
  reference = "",
  notes = "",
  requestKey,
  performedBy,
}) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      // 1. Check whether this request was already saved.
      const existingPayment = await SupplierPayment
        .findOne({ requestKey })
        .session(session);

      if (existingPayment) {
        fail("Payment request already recorded", 409);
      }

      // 2. Retrieve the purchase.
      const purchase = await Purchase.findById(
        purchaseId
      ).session(session);

      if (!purchase) {
        fail("Purchase not found", 404);
      }

      if (purchase.balanceDue <= 0) {
        fail("This purchase is already fully paid", 409);
      }

      if (amount > purchase.balanceDue) {
        fail(
          "Payment exceeds the outstanding balance",
          400
        );
      }

      // 3. Atomically update the purchase balance.
      // This condition protects against overpayment.
      const updatedPurchase =
        await Purchase.findOneAndUpdate(
          {
            _id: purchaseId,
            balanceDue: { $gte: amount },
          },
          {
            $inc: {
              amountPaid: amount,
              balanceDue: -amount,
            },
          },
          {
            new: true,
            runValidators: true,
            session,
          }
        );

      if (!updatedPurchase) {
        fail(
          "Outstanding balance changed. Please retry.",
          409
        );
      }

      // 4. Update the payment status.
      updatedPurchase.paymentStatus =
        updatedPurchase.balanceDue === 0
          ? "paid"
          : "partial";

      await updatedPurchase.save({ session });

      // 5. Save the actual payment record.
      const [payment] = await SupplierPayment.create(
        [
          {
            purchase: updatedPurchase._id,
            supplier: updatedPurchase.supplier,
            branch: updatedPurchase.branch,
            amount,
            method,
            reference,
            notes,
            requestKey,
            recordedBy: performedBy,
          },
        ],
        { session }
      );

      result = {
        payment,
        purchase: updatedPurchase,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  recordSupplierRepayment,
};
