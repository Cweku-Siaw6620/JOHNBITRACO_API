
const express = require("express");

const authenticate = require(
  "../middlewares/authenticate"
);

const {
  authorize,
} = require("../middlewares/authorize");

const {
  createCustomer,
  getCustomers,
} = require("../controllers/customerController");

const router = express.Router();

router.use(authenticate);
router.use(authorize("admin", "assistant"));

router.get("/", getCustomers);
router.post("/", createCustomer);

module.exports = router;
