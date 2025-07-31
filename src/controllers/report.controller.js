import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { Expense } from "../models/expense.model.js";
import { Contribution } from "../models/contribution.model.js";
import { Festival } from "../models/festival.model.js";

export const getFestivalReport = asyncHandler(async (req, res) => {
  const { festivalId } = req.params;

  const festival = await Festival.findById(festivalId);
  if (!festival) {
    return res.status(404).json(new ApiResponse(404, null, "Festival not found"));
  }

  const contributions = await Contribution.find({ festivalId });
  const expenses = await Expense.find({ festivalId });

  const totalCash = contributions
    .filter((c) => c.type === "cash")
    .reduce((sum, c) => sum + (c.amount || 0), 0);

  const totalItemsValue = contributions
    .filter((c) => c.type === "item" && c.status === "deposited")
    .reduce((sum, c) => sum + (c.estimatedValue || 0), 0);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const balance = festival.openingBalance + totalCash - totalExpenses;

  const data = {
    festival: {
      name: festival.name,
      year: festival.year,
      openingBalance: festival.openingBalance,
    },
    totalCash,
    totalItemsValue,
    totalExpenses,
    balance,
    contributionCount: contributions.length,
    expenseCount: expenses.length,
  };

  res.status(200).json(new ApiResponse(200, data, `Report for festival ${festival.name}`));
});

export const exportFestivalReportPdf = asyncHandler(async (req, res) => {
  const { festivalId } = req.params;
  // Later: Generate PDF using puppeteer or PDFKit

  // Placeholder logic
  res.status(200).json(new ApiResponse(200, {}, `PDF exported for festival ${festivalId}`));
});

export const exportContributionsPdf = asyncHandler(async (req, res) => {
  const { festivalId } = req.query;
  const contributions = await Contribution.find({ festivalId }).populate("contributorId", "name");

  // Later: Generate actual PDF and stream or download
  res
    .status(200)
    .json(new ApiResponse(200, contributions, `Contribution PDF for festival ${festivalId}`));
});

export const exportExpensesPdf = asyncHandler(async (req, res) => {
  const { festivalId } = req.query;
  const expenses = await Expense.find({ festivalId });

  // Later: Generate PDF logic
  res.status(200).json(new ApiResponse(200, expenses, `Expenses PDF for festival ${festivalId}`));
});

export const getFestivalStats = asyncHandler(async (req, res) => {
  const festival = await Festival.findById(req.params.festivalId).select("stats");
  if (!festival) {
    return res.status(404).json(new ApiResponse(404, {}, "Festival not found"));
  }

  res.status(200).json(new ApiResponse(200, festival.stats, "Festival stats retrieved"));
});
