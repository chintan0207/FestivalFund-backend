import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";

export const loginUser = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, {}, "Logged in successfully"));
});

export const registerUser = asyncHandler(async (req, res) => {
  res.status(201).json(new ApiResponse(201, {}, "User registered successfully"));
});

export const getLoggedInUser = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, {}, "User profile fetched"));
});
