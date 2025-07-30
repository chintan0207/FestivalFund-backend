import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";

export const getAllContributions = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, [], "Fetched all contributions"));
});

export const getContributionById = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, {}, `Fetched contribution ${req.params.id}`));
});

export const createContribution = asyncHandler(async (req, res) => {
  res.status(201).json(new ApiResponse(201, {}, "Contribution recorded"));
});

export const updateContribution = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, {}, `Contribution ${req.params.id} updated`));
});

export const deleteContribution = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, null, `Contribution ${req.params.id} deleted`));
});

export const generateContributionSlip = asyncHandler(async (req, res) => {
  res
    .status(200)
    .json(new ApiResponse(200, {}, `Slip generated for contribution ${req.params.id}`));
});
