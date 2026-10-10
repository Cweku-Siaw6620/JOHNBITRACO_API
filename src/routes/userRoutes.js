const express = require("express");

const authenticate = require("../middlewares/authenticate");

const {
  authorize,
} = require("../middlewares/authorize");

const {
  createUser,
  getUsers,
  updateUser,
  resetPin,
} = require("../controllers/userController");

const router = express.Router();

router.use(authenticate);

router.use(authorize("admin"));

router.get("/", getUsers);

router.post("/", createUser);

router.patch("/:id", updateUser);

router.patch("/:id/pin", resetPin);

module.exports = router;