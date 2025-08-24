import mongoose from "mongoose";
import { Contribution } from "../models/contribution.model.js";
import { Expense } from "../models/expense.model.js";
import { Festival } from "../models/festival.model.js";
import { ContributionStatusEnum } from "./constants.js";

export const updateFestivalStats = async (festivalId) => {
  const [deposited, pending, expenses, categoryTotals] = await Promise.all([
    Contribution.aggregate([
      {
        $match: {
          festivalId: new mongoose.Types.ObjectId(festivalId),
          status: ContributionStatusEnum.DEPOSITED,
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),

    Contribution.aggregate([
      {
        $match: {
          festivalId: new mongoose.Types.ObjectId(festivalId),
          status: ContributionStatusEnum.PENDING,
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),

    Expense.aggregate([
      { $match: { festivalId: new mongoose.Types.ObjectId(festivalId) } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),

    Expense.aggregate([
      { $match: { festivalId: new mongoose.Types.ObjectId(festivalId) } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
    ]),
  ]);

  const totalCollected = deposited[0]?.total || 0;
  const pendingAmount = pending[0]?.total || 0;
  const totalExpenses = expenses[0]?.total || 0;

  const festival = await Festival.findById(festivalId);
  const opening = festival?.stats?.openingBalance || 0;
  const currentBalance = opening + totalCollected - totalExpenses;

  const categoryTotalsObj = categoryTotals.reduce((acc, item) => {
    acc[item._id] = item.total;
    return acc;
  }, {});

  const updatedStats = {
    openingBalance: opening,
    totalCollected,
    pendingAmount,
    totalExpenses,
    currentBalance,
    categoryTotals: categoryTotalsObj,
  };

  await Festival.findByIdAndUpdate(festivalId, { stats: updatedStats });

  return updatedStats;
};
