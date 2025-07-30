import mongoose from "mongoose";
import { AvailableExpenseCategories } from "../utils/constants.js";

const expenseSchema = new mongoose.Schema(
  {
    festivalId: { type: mongoose.Schema.Types.ObjectId, ref: "Festival", required: true },
    category: { type: String, enum: AvailableExpenseCategories, required: true },
    amount: { type: Number, required: true },
    description: { type: String },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const Expense = mongoose.model("Expense", expenseSchema);
