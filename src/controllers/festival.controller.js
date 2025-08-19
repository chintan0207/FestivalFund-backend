import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { Festival } from "../models/festival.model.js";

export const getAllFestivals = asyncHandler(async (req, res) => {
  const festivals = await Festival.find().sort({ year: -1, name: 1 });
  res.status(200).json(new ApiResponse(200, festivals, "Fetched all festivals"));
});

export const getFestivalById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const festival = await Festival.findById(id);
  if (!festival) {
    throw new ApiError(404, "Festival not found");
  }

  res.status(200).json(new ApiResponse(200, festival, `Fetched festival`));
});

export const createFestival = asyncHandler(async (req, res) => {
  const { name, year, openingBalance } = req.body;

  if (!name || !year) {
    throw new ApiError(400, "Name and year are required");
  }

  const existingFestival = await Festival.findOne({ name, year });
  if (existingFestival) {
    throw new ApiError(409, "Festival with the same name and year already exists");
  }

  const newFestival = await Festival.create({
    name,
    year,
    stats: {
      openingBalance: openingBalance ?? 0,
      totalCollected: 0,
      pendingAmount: 0,
      totalExpenses: 0,
      currentBalance: openingBalance ?? 0, // current = opening initially
    },
  });

  res.status(201).json(new ApiResponse(201, newFestival, "Festival created"));
});

export const updateFestival = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, year, openingBalance } = req.body;

  const festival = await Festival.findById(id);
  if (!festival) {
    throw new ApiError(404, "Festival not found");
  }

  if ((name && name !== festival.name) || (year && year !== festival.year)) {
    const duplicate = await Festival.findOne({
      name: name ?? festival.name,
      year: year ?? festival.year,
    });
    if (duplicate && duplicate._id.toString() !== id) {
      throw new ApiError(409, "Another festival with same name and year already exists");
    }
  }

  festival.name = name ?? festival.name;
  festival.year = year ?? festival.year;

  if (openingBalance !== undefined) {
    festival.stats.openingBalance = openingBalance;

    const { totalCollected, totalExpenses } = festival.stats;
    festival.stats.currentBalance = openingBalance + totalCollected - totalExpenses;
  }

  await festival.save();

  res.status(200).json(new ApiResponse(200, festival, `Festival updated`));
});

export const deleteFestival = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const festival = await Festival.findById(id);
  if (!festival) {
    throw new ApiError(404, "Festival not found");
  }

  await festival.deleteOne();

  res.status(200).json(new ApiResponse(200, null, `Festival deleted`));
});
