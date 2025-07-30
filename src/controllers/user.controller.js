import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";

export const getAllUsers = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, [], "Fetched all users"));
});

export const createUser = asyncHandler(async (req, res) => {
  res.status(201).json(new ApiResponse(201, {}, "User created"));
});

export const updateUser = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, {}, `User ${req.params.id} updated`));
});

export const deleteUser = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, null, `User ${req.params.id} deleted`));
});
