import mongoose from "mongoose";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { Contribution } from "../models/contribution.model.js";
import { updateFestivalStats } from "../utils/utility.js";

// GET all contributions with filters and pagination
export const getAllContributions = asyncHandler(async (req, res) => {
  let {
    page,
    limit,
    sortOrder = "desc",
    sortField = "createdAt",
    search = "",
    festivalId,
    contributorId,
    status,
    type,
    startDate,
    endDate,
    minAmount,
    maxAmount,
  } = req.query;

  const sortDirection = sortOrder === "asc" ? 1 : -1;
  const usePagination = page !== undefined && limit !== undefined;
  const pageNumber = usePagination ? parseInt(page) : 1;
  const limitNumber = usePagination ? parseInt(limit) : 0;
  const skip = (pageNumber - 1) * limitNumber;

  const matchStage = {
    ...(festivalId && { festivalId: new mongoose.Types.ObjectId(festivalId) }),
    ...(contributorId && { contributorId: new mongoose.Types.ObjectId(contributorId) }),
    ...(status && { status }),
    ...(type && { type }),
    ...(startDate || endDate
      ? {
          date: {
            ...(startDate && { $gte: new Date(startDate) }),
            ...(endDate && { $lte: new Date(endDate) }),
          },
        }
      : {}),
    ...(minAmount || maxAmount
      ? {
          amount: {
            ...(minAmount && { $gte: parseFloat(minAmount) }),
            ...(maxAmount && { $lte: parseFloat(maxAmount) }),
          },
        }
      : {}),
  };

  const pipeline = [
    { $match: matchStage },
    {
      $lookup: {
        from: "contributors",
        localField: "contributorId",
        foreignField: "_id",
        as: "contributor",
      },
    },
    { $unwind: { path: "$contributor", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "festivals",
        localField: "festivalId",
        foreignField: "_id",
        as: "festival",
      },
    },
    { $unwind: { path: "$festival", preserveNullAndEmptyArrays: true } },
    ...(search.trim()
      ? [
          {
            $match: {
              $or: [
                { "contributor.name": { $regex: search, $options: "i" } },
                { "contributor.address": { $regex: search, $options: "i" } },
                { itemName: { $regex: search, $options: "i" } },
              ],
            },
          },
        ]
      : []),
    {
      $project: {
        type: 1,
        status: 1,
        date: 1,
        amount: 1,
        itemName: 1,
        quantity: 1,
        estimatedValue: 1,
        contributorId: 1,
        festivalId: 1,
        "contributor.name": 1,
        "contributor.category": 1,
        "contributor.phoneNumber": 1,
        "festival.name": 1,
        "festival.year": 1,
      },
    },
    {
      $sort: {
        [sortField]: sortDirection,
      },
    },
  ];

  if (usePagination) {
    pipeline.push({
      $facet: {
        metaData: [
          { $count: "total" },
          {
            $addFields: {
              page: pageNumber,
              limit: limitNumber,
              totalPages: {
                $ceil: { $divide: ["$total", limitNumber] },
              },
            },
          },
        ],
        data: [{ $skip: skip }, { $limit: limitNumber }],
      },
    });
  }

  const result = await Contribution.aggregate(pipeline).collation({
    locale: "en",
    strength: 2,
  });

  let contributions, paginationData;
  if (usePagination) {
    const { metaData = [], data = [] } = result[0] || {};
    contributions = data;
    paginationData = metaData[0] || {
      total: 0,
      page: pageNumber,
      limit: limitNumber,
      totalPages: 0,
    };
  } else {
    contributions = result;
    paginationData = {
      total: contributions.length,
      page: 1,
      limit: contributions.length,
      totalPages: 1,
    };
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { contributions, ...paginationData },
        contributions.length > 0 ? "Contributions fetched " : "No contributions found",
      ),
    );
});

export const getContributionById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const contribution = await Contribution.findById(id)
    .populate("contributorId", "name category phoneNumber")
    .populate("festivalId", "name year");

  if (!contribution) {
    return res.status(404).json(new ApiResponse(404, {}, "Contribution not found"));
  }

  res.status(200).json(new ApiResponse(200, contribution, "Fetched contribution"));
});

export const createContribution = asyncHandler(async (req, res) => {
  const data = req.body;

  const newContribution = await Contribution.create(data);

  if (!newContribution) {
    return res.status(400).json(new ApiResponse(400, {}, "Failed to create contribution"));
  }

  await updateFestivalStats(newContribution?.festivalId);

  res.status(201).json(new ApiResponse(201, newContribution, "Contribution recorded "));
});

export const updateContribution = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const update = req.body;

  const updated = await Contribution.findByIdAndUpdate(id, update, { new: true });

  if (!updated) {
    return res.status(404).json(new ApiResponse(404, {}, "Contribution not found"));
  }

  await updateFestivalStats(updated?.festivalId);

  res.status(200).json(new ApiResponse(200, updated, `Contribution  updated `));
});

export const deleteContribution = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deleted = await Contribution.findByIdAndDelete(id);

  if (!deleted) {
    return res.status(404).json(new ApiResponse(404, {}, "Contribution not found"));
  }

  await updateFestivalStats(deleted?.festivalId);

  res.status(200).json(new ApiResponse(200, null, `Contribution  deleted`));
});

// GENERATE slip for a contribution
export const generateContributionSlip = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const contribution = await Contribution.findById(id)
    .populate("contributorId", "name address category phoneNumber")
    .populate("festivalId", "name year");

  if (!contribution) {
    return res.status(404).json(new ApiResponse(404, {}, "Contribution not found"));
  }

  // In real use-case, generate PDF or print-ready format
  res
    .status(200)
    .json(new ApiResponse(200, { slip: contribution }, `Slip generated for contribution `));
});
