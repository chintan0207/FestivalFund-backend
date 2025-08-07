import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { Contributor } from "../models/contributor.model.js";
import mongoose from "mongoose";
import { ApiError } from "../utils/api-error.js";

export const createContributor = asyncHandler(async (req, res) => {
  const { name, address, category, festivalId, phoneNumber } = req.body;

  if (!name || !festivalId) {
    throw new ApiError(400, "Name and festivalId are required");
  }

  const contributor = await Contributor.create({
    name,
    address,
    category,
    festivalId,
    phoneNumber,
  });

  res.status(201).json(new ApiResponse(201, contributor, "Contributor created "));
});

export const getContributorById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const contributor = await Contributor.findById(id).populate({
    path: "festivalId",
    select: "name year",
  });

  if (!contributor) {
    throw new ApiError(404, "Contributor not found");
  }

  res.status(200).json(new ApiResponse(200, contributor, `Fetched contributor`));
});

export const getAllContributors = asyncHandler(async (req, res) => {
  let {
    page,
    limit,
    sortOrder = "desc",
    sortField = "createdAt",
    search = "",
    festivalId,
  } = req.query;

  const sortDirection = sortOrder === "asc" ? 1 : -1;
  const usePagination = page !== undefined && limit !== undefined;
  const pageNumber = usePagination ? parseInt(page) : 1;
  const limitNumber = usePagination ? parseInt(limit) : 0;
  const skip = (pageNumber - 1) * limitNumber;

  try {
    const session = await mongoose.startSession();
    session.startTransaction();

    const matchStage = {
      ...(festivalId && { festivalId: new mongoose.Types.ObjectId(festivalId) }),
    };

    const searchStage = search.trim()
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { address: { $regex: search, $options: "i" } },
            { category: { $regex: search, $options: "i" } },
            { phoneNumber: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const pipeline = [
      { $match: { ...matchStage, ...searchStage } },
      {
        $lookup: {
          from: "festivals",
          localField: "festivalId",
          foreignField: "_id",
          as: "festival",
        },
      },
      {
        $unwind: {
          path: "$festival",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          name: 1,
          address: 1,
          phoneNumber: 1,
          category: 1,
          createdAt: 1,
          updatedAt: 1,
          festivalId: 1,
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

    const stringSortFields = ["name", "category", "festival.name"];
    const result = stringSortFields.includes(sortField)
      ? await Contributor.aggregate(pipeline).collation({ locale: "en", strength: 2 })
      : await Contributor.aggregate(pipeline);

    let contributors, paginationData;

    if (usePagination) {
      const { metaData = [], data = [] } = result[0] || {};
      contributors = data;
      paginationData = metaData[0] || {
        total: 0,
        page: pageNumber,
        limit: limitNumber,
        totalPages: 0,
      };
    } else {
      contributors = result;
      paginationData = {
        total: contributors.length,
        page: 1,
        limit: contributors.length,
        totalPages: 1,
      };
    }

    await session.commitTransaction();

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { contributors, ...paginationData },
          contributors.length > 0 ? "Contributors fetched " : "No contributors found",
        ),
      );
  } catch (error) {
    console.error("Error fetching contributors:", error);
    res.status(500).json(new ApiResponse(500, {}, "Failed to fetch contributors"));
  }
});

export const updateContributor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, address, category, phoneNumber } = req.body;

  const contributor = await Contributor.findById(id);
  if (!contributor) {
    throw new ApiError(404, "Contributor not found");
  }

  contributor.name = name ?? contributor.name;
  contributor.address = address ?? contributor.address;
  contributor.category = category ?? contributor.category;
  contributor.phoneNumber = phoneNumber ?? contributor.phoneNumber;

  await contributor.save();

  res.status(200).json(new ApiResponse(200, contributor, `Contributor updated `));
});

export const deleteContributor = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const contributor = await Contributor.findById(id);
  if (!contributor) {
    throw new ApiError(404, "Contributor not found");
  }

  await contributor.deleteOne();

  res.status(200).json(new ApiResponse(200, null, `Contributor deleted `));
});
