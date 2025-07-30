import mongoose from "mongoose";
import {
  ContributionStatusEnum,
  AvailableContributionStatuses,
  AvailableContributionTypes,
} from "../utils/constants.js";

const contributionSchema = new mongoose.Schema(
  {
    contributorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contributor",
      required: true,
    },
    festivalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Festival",
      required: true,
    },
    type: {
      type: String,
      enum: AvailableContributionTypes,
      required: true, // "cash" or "item"
    },
    status: {
      type: String,
      enum: AvailableContributionStatuses,
      default: ContributionStatusEnum.PENDING,
    },
    date: {
      type: Date,
      default: Date.now,
    },

    // For cash
    amount: Number,

    // For items
    itemName: String,
    quantity: Number,
    estimatedValue: Number,
  },
  { timestamps: true },
);

export const Contribution = mongoose.model("Contribution", contributionSchema);
