import mongoose from "mongoose";

const festivalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    year: { type: Number, required: true },
    stats: {
      openingBalance: { type: Number, default: 0 },
      totalCollected: { type: Number, default: 0 },
      pendingAmount: { type: Number, default: 0 },
      totalExpenses: { type: Number, default: 0 },
      currentBalance: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

festivalSchema.index({ name: 1, year: 1 }, { unique: true });
export const Festival = mongoose.model("Festival", festivalSchema);
