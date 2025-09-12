import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { User } from "../models/user.model.js";

dotenv.config();

export const verifyJwt = asyncHandler(async (req, _, next) => {
  // Check for token in cookies or headers
  const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedtoken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findOne({ _id: decodedtoken._id }).select("-password -refreshToken");

    if (!user) {
      throw new ApiError(401, "Invalid access token");
    }

    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Access Token");
  }
});
