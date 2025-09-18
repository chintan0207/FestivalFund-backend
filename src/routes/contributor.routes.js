import express from "express";
import {
  getAllContributors,
  createContributor,
  updateContributor,
  deleteContributor,
  getContributorById,
  allContributorsPdf,
} from "../controllers/contributor.controller.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", verifyJwt, getAllContributors);
router.post("/", verifyJwt, createContributor);
router.get("/:id", verifyJwt, getContributorById);
router.patch("/:id", verifyJwt, updateContributor);
router.delete("/:id", verifyJwt, deleteContributor);
router.get("/all/pdf", verifyJwt, allContributorsPdf);

export default router;
