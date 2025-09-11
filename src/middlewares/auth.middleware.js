import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { User } from "../models/user.model.js";

dotenv.config();

export const verifyJwt = asyncHandler(async (req, _, next) => {
  console.log("🔍 [verifyJwt] Incoming request...");

  // Check for token in cookies or headers
  const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", ""); // notice the space

  console.log("📦 [verifyJwt] Extracted Token:", token ? "[FOUND]" : "[MISSING]");

  if (!token) {
    console.error("❌ [verifyJwt] No token provided");
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedtoken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    console.log("✅ [verifyJwt] Token decoded:", decodedtoken);

    const user = await User.findOne({ _id: decodedtoken._id }).select("-password -refreshToken");

    if (!user) {
      console.error("❌ [verifyJwt] User not found for token:", decodedtoken._id);
      throw new ApiError(401, "Invalid access token");
    }

    console.log("👤 [verifyJwt] User verified:", {
      id: user._id,
      email: user.email,
    });

    req.user = user;
    next();
  } catch (error) {
    console.error("❌ [verifyJwt] Token verification failed:", error.message);
    throw new ApiError(401, error?.message || "Invalid Access Token");
  }
});
