import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { User } from "../models/User.model.js";

export const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select("-password -refreshToken");
  res.status(200).json(new ApiResponse(200, users, "Fetched all users"));
});

export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, "Name, email, and password are required");
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    throw new ApiError(409, "User already exists with this email");
  }

  const newUser = await User.create({ name, email, password, role });
  const sanitizedUser = newUser.toObject();
  delete sanitizedUser.password;
  delete sanitizedUser.refreshToken;

  res.status(201).json(new ApiResponse(201, sanitizedUser, "User created"));
});

export const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, role } = req.body;

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  user.name = name ?? user.name;
  user.email = email ?? user.email;
  user.role = role ?? user.role;

  await user.save();

  const updatedUser = user.toObject();
  delete updatedUser.password;
  delete updatedUser.refreshToken;

  res.status(200).json(new ApiResponse(200, updatedUser, `User updated`));
});

export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  await user.deleteOne();

  res.status(200).json(new ApiResponse(200, null, `User deleted`));
});
