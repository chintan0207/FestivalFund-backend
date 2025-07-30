import mongoose from "mongoose";
import { GlobalRoleEnum, AvailableGlobalRoles } from "../utils/constants.js";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: AvailableGlobalRoles, default: GlobalRoleEnum.VIEWER },
  },
  { timestamps: true },
);

export const User = mongoose.model("User", userSchema);
