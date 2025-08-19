import mongoose from "mongoose";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { Contribution } from "../models/contribution.model.js";
import { updateFestivalStats } from "../utils/utility.js";
import { Contributor } from "../models/contributor.model.js";

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
    category,
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
    ...(category
      ? [
          {
            $match: {
              "contributor.category": category,
            },
          },
        ]
      : []),
    {
      $lookup: {
        from: "festivals",
        localField: "festivalId",
        foreignField: "_id",
        as: "festival",
      },
    },
    { $unwind: { path: "$festival", preserveNullAndEmptyArrays: true } },
  ];

  if (search.trim()) {
    pipeline.push({
      $match: {
        $or: [
          { "contributor.name": { $regex: search, $options: "i" } },
          { "contributor.address": { $regex: search, $options: "i" } },
          { itemName: { $regex: search, $options: "i" } },
          {
            $expr: {
              $regexMatch: { input: { $toString: "$amount" }, regex: search, options: "i" },
            },
          },
        ],
      },
    });
  }

  pipeline.push({
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
      createdAt: 1,
      updatedAt: 1,
    },
  });

  if (sortField === "name") {
    pipeline.push({ $sort: { "contributor.name": sortDirection } });
  } else {
    pipeline.push({ $sort: { [sortField]: sortDirection } });
  }

  if (usePagination) {
    pipeline.push({
      $facet: {
        metaData: [
          { $count: "total" },
          {
            $addFields: {
              page: pageNumber,
              limit: limitNumber,
              totalPages: { $ceil: { $divide: ["$total", limitNumber] } },
            },
          },
        ],
        data: [{ $skip: skip }, { $limit: limitNumber }],
      },
    });
  }

  // Run aggregation
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
        contributions.length > 0 ? "Contributions fetched" : "No contributions found",
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
  const { contributorId, name, category, phoneNumber, address, festivalId, ...contributionData } =
    req.body;

  let finalContributorId = contributorId;

  // If contributorId not provided, create/find contributor
  if (!finalContributorId && name && category && festivalId) {
    let contributor = await Contributor.findOne({
      name: name.trim(),
      category,
      festivalId,
    });

    if (!contributor) {
      contributor = await Contributor.create({
        name: name.trim(),
        category,
        phoneNumber: phoneNumber || "",
        address: address || "",
        festivalId,
      });
    }
    finalContributorId = contributor._id;
  }

  if (!finalContributorId) {
    return res
      .status(400)
      .json(new ApiResponse(400, {}, "Contributor ID or valid contributor details are required"));
  }

  const contribution = await Contribution.create({
    ...contributionData,
    contributorId: finalContributorId,
    festivalId,
  });

  const populatedContribution = await Contribution.findById(contribution._id)
    .populate({
      path: "contributorId",
      select: "name category phoneNumber",
    })
    .populate({
      path: "festivalId",
      select: "name year",
    })
    .lean();

  if (!populatedContribution) {
    return res.status(400).json(new ApiResponse(400, {}, "Failed to create contribution"));
  }

  const responseData = {
    ...populatedContribution,
    contributor: populatedContribution.contributorId,
    festival: populatedContribution.festivalId,
  };
  delete responseData.contributorId;
  delete responseData.festivalId;

  // get updated stats
  const updatedStats = await updateFestivalStats(festivalId);

  res.status(201).json(
    new ApiResponse(
      201,
      {
        contribution: responseData,
        festivalStats: updatedStats, // <-- Send updated stats
      },
      "Contribution recorded",
    ),
  );
});

export const updateContribution = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const updated = await Contribution.findByIdAndUpdate(id, updateData, { new: true });

  if (!updated) {
    return res.status(404).json(new ApiResponse(404, {}, "Contribution not found"));
  }

  const [contribution] = await Contribution.aggregate([
    { $match: { _id: updated._id } },
    {
      $lookup: {
        from: "contributors",
        localField: "contributorId",
        foreignField: "_id",
        as: "contributor",
      },
    },
    { $unwind: "$contributor" },
    {
      $lookup: {
        from: "festivals",
        localField: "festivalId",
        foreignField: "_id",
        as: "festival",
      },
    },
    { $unwind: "$festival" },
    {
      $project: {
        _id: 1,
        contributorId: "$contributor._id",
        festivalId: "$festival._id",
        type: 1,
        status: 1,
        date: 1,
        amount: 1,
        itemName: 1,
        contributor: {
          name: "$contributor.name",
          phoneNumber: "$contributor.phoneNumber",
          category: "$contributor.category",
        },
        festival: {
          name: "$festival.name",
          year: "$festival.year",
        },
      },
    },
  ]);

  const updatedStats = await updateFestivalStats(updated.festivalId);

  res
    .status(200)
    .json(
      new ApiResponse(200, { contribution, festivalStats: updatedStats }, "Contribution updated"),
    );
});

export const deleteContribution = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deleted = await Contribution.findByIdAndDelete(id);

  if (!deleted) {
    return res.status(404).json(new ApiResponse(404, {}, "Contribution not found"));
  }

  const updatedStats = await updateFestivalStats(deleted?.festivalId);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        festivalStats: updatedStats,
      },
      "Contribution deleted",
    ),
  );
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
