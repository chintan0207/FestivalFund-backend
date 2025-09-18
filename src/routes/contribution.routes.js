import express from "express";
import {
  getAllContributions,
  getContributionById,
  createContribution,
  updateContribution,
  deleteContribution,
  generateContributionSlip,
  contributionsPdfByFestival,
} from "../controllers/contribution.controller.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", verifyJwt, getAllContributions);
router.get("/:id", verifyJwt, getContributionById);
router.post("/", verifyJwt, createContribution);
router.patch("/:id", verifyJwt, updateContribution);
router.delete("/:id", verifyJwt, deleteContribution);
router.get("/:id/slip", verifyJwt, generateContributionSlip);
router.get("/pdf/:festivalId", verifyJwt, contributionsPdfByFestival);

export default router;
