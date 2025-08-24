import express from "express";
import {
  getAllExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseById,
} from "../controllers/expense.controller.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", getAllExpenses);
router.post("/", createExpense);
router.patch("/:id", updateExpense);
router.get("/:id", getExpenseById);
router.delete("/:id", deleteExpense);

export default router;
