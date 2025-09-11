import express from "express";
import {
  getAllFestivals,
  getFestivalById,
  createFestival,
  updateFestival,
  deleteFestival,
} from "../controllers/festival.controller.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", verifyJwt, getAllFestivals);
router.get("/:id", verifyJwt, getFestivalById);
router.post("/", verifyJwt, createFestival);
router.patch("/:id", verifyJwt, updateFestival);
router.delete("/:id", verifyJwt, deleteFestival);

export default router;
