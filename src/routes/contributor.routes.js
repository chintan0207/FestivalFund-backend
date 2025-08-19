import express from "express";
import {
  getAllContributors,
  createContributor,
  updateContributor,
  deleteContributor,
  getContributorById,
} from "../controllers/contributor.controller.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", getAllContributors);
router.post("/", createContributor);
router.get("/:id", getContributorById);
router.patch("/:id", updateContributor);
router.delete("/:id", deleteContributor);

export default router;
