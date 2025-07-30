import express from "express";
import {
  getAllContributions,
  getContributionById,
  createContribution,
  updateContribution,
  deleteContribution,
  generateContributionSlip,
} from "../controllers/contribution.controller.js";

const router = express.Router();

router.get("/", getAllContributions);
router.get("/:id", getContributionById);
router.post("/", createContribution);
router.patch("/:id", updateContribution);
router.delete("/:id", deleteContribution);
router.get("/:id/slip", generateContributionSlip);

export default router;
