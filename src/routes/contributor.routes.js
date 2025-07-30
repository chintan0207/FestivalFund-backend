import express from "express";
import {
  getAllContributors,
  createContributor,
  updateContributor,
  deleteContributor,
} from "../controllers/contributor.controller.js";

const router = express.Router();

router.get("/", getAllContributors);
router.post("/", createContributor);
router.patch("/:id", updateContributor);
router.delete("/:id", deleteContributor);

export default router;
