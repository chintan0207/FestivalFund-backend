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

router.get("/", verifyJwt, getAllContributors);
router.post("/", verifyJwt, createContributor);
router.get("/:id", verifyJwt, getContributorById);
router.patch("/:id", verifyJwt, updateContributor);
router.delete("/:id", verifyJwt, deleteContributor);

export default router;
