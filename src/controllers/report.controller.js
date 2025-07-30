import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";

export const getFestivalReport = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, {}, `Report for festival ${req.params.festivalId}`));
});

export const exportFestivalReportPdf = asyncHandler(async (req, res) => {
  res
    .status(200)
    .json(new ApiResponse(200, {}, `PDF exported for festival ${req.params.festivalId}`));
});

export const exportContributionsPdf = asyncHandler(async (req, res) => {
  res
    .status(200)
    .json(new ApiResponse(200, {}, `Contribution PDF for festival ${req.query.festivalId}`));
});

export const exportExpensesPdf = asyncHandler(async (req, res) => {
  res
    .status(200)
    .json(new ApiResponse(200, {}, `Expenses PDF for festival ${req.query.festivalId}`));
});
