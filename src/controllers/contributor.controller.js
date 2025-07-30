import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";

export const getAllContributors = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, [], "Fetched all contributors"));
});

export const createContributor = asyncHandler(async (req, res) => {
  res.status(201).json(new ApiResponse(201, {}, "Contributor created"));
});

export const updateContributor = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, {}, `Contributor ${req.params.id} updated`));
});

export const deleteContributor = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, null, `Contributor ${req.params.id} deleted`));
});
