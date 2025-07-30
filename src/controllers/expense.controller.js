import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";

export const getAllExpenses = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, [], "Fetched all expenses"));
});

export const createExpense = asyncHandler(async (req, res) => {
  res.status(201).json(new ApiResponse(201, {}, "Expense added"));
});

export const updateExpense = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, {}, `Expense ${req.params.id} updated`));
});

export const deleteExpense = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, null, `Expense ${req.params.id} deleted`));
});
