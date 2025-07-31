import express from "express";
import {
  getAllExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseById,
} from "../controllers/expense.controller.js";
import { get } from "mongoose";
import { verifyJwt } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", verifyJwt, getAllExpenses);
router.post("/", verifyJwt, createExpense);
router.patch("/:id", verifyJwt, updateExpense);
router.get("/:id", verifyJwt, getExpenseById);
router.delete("/:id", verifyJwt, deleteExpense);

export default router;
