import mongoose from "mongoose";
import { ContributorCategoryEnum, AvailableContributorCategories } from "../utils/constants.js";

const contributorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phoneNumber: { type: String },
    address: { type: String },
    category: {
      type: String,
      enum: AvailableContributorCategories,
      default: ContributorCategoryEnum.PARENT,
    },
    festivalId: { type: mongoose.Schema.Types.ObjectId, ref: "Festival", required: true },
  },
  { timestamps: true },
);

export const Contributor = mongoose.model("Contributor", contributorSchema);
