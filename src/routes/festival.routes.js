import express from "express";
import {
  getAllFestivals,
  getFestivalById,
  createFestival,
  updateFestival,
  deleteFestival,
} from "../controllers/festival.controller.js";

const router = express.Router();

router.get("/", getAllFestivals);
router.get("/:id", getFestivalById);
router.post("/", createFestival);
router.patch("/:id", updateFestival);
router.delete("/:id", deleteFestival);

export default router;
