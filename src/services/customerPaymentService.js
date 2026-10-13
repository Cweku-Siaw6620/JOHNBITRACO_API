
const mongoose = require("mongoose");

const Sale = require("../models/Sale");
const CustomerPayment = require(
  "../models/CustomerPayment"
);

const fail = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};

const recordCustomerPayment = async ({
  saleId,
  amount,
  method,
  reference = "",
  requestKey,
  performedBy,
}) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const existing = await CustomerPayment
        .findOne({ requestKey })
        .session(session);

      if (existing) {
        fail("Payment request already recorded", 409);
      }

      const sale = await Sale.findById(
        saleId
      ).session(session);

      if (!sale) {
        fail("Sale not found", 404);
      }

      if (sale.status !== "completed") {
        fail(
          "Payments on returned sales require reconciliation",
          409
        );
      }

      if (sale.balanceDue <= 0) {
        fail("Sale is already fully paid", 409);
      }

      if (amount > sale.balanceDue) {
        fail("Payment exceeds outstanding balance");
      }

      const updatedSale = await Sale.findOneAndUpdate(
        {
          _id: saleId,
          status: "completed",
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

      if (!updatedSale) {
        fail("Sale balance changed. Retry.", 409);
      }

      updatedSale.paymentStatus =
        updatedSale.balanceDue === 0
          ? "paid"
          : "partial";

      await updatedSale.save({ session });

      const [payment] = await CustomerPayment.create(
        [
          {
            sale: updatedSale._id,
            customer: updatedSale.customer,
            branch: updatedSale.branch,
            amount,
            method,
            reference,
            requestKey,
            recordedBy: performedBy,
          },
        ],
        { session }
      );

      result = {
        payment,
        sale: updatedSale,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  recordCustomerPayment,
};
