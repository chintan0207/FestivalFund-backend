import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";

export const getAllFestivals = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, [], "Fetched all festivals"));
});

export const getFestivalById = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, {}, `Fetched festival ${req.params.id}`));
});

export const createFestival = asyncHandler(async (req, res) => {
  res.status(201).json(new ApiResponse(201, {}, "Festival created"));
});

export const updateFestival = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, {}, `Festival ${req.params.id} updated`));
});

export const deleteFestival = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, null, `Festival ${req.params.id} deleted`));
});
