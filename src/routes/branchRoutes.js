const express = require("express");

const authenticate = require("../middlewares/authenticate");

const {
  authorize,
} = require("../middlewares/authorize");

const {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
} = require("../controllers/branchController");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  authorize("admin", "assistant", "employee"),
  getBranches
);

router.post(
  "/",
  authorize("admin"),
  createBranch
);

router.patch(
  "/:id",
  authorize("admin"),
  updateBranch
);

router.delete(
  "/:id",
  authorize("admin"),
  deleteBranch
);

module.exports = router;