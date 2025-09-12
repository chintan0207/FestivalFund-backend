import mongoose from "mongoose";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { Contribution } from "../models/contribution.model.js";
import { updateFestivalStats } from "../utils/utility.js";
import { Contributor } from "../models/contributor.model.js";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappFrom = "whatsapp:+14155238886";
const client = twilio(accountSid, authToken);

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
        festivalStats: updatedStats,
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

const sendWhatsAppReceipt = async (contributor, festival, fileUrl) => {
  if (!contributor.phoneNumber) return;

  try {
    await client.messages.create({
      from: whatsappFrom,
      to: `whatsapp:+91${contributor.phoneNumber}`,
      body: `Dear ${contributor.name}, here is your contribution receipt for ${festival.name} ${festival.year}. 🙏`,
      mediaUrl: [fileUrl],
    });
  } catch (err) {
    console.error("Error sending WhatsApp:", err.message);
  }
};

// GENERATE slip for a contribution
export const generateContributionSlip = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // --- Fetch contribution ---
  const contribution = await Contribution.findById(id)
    .populate("contributorId", "name address category phoneNumber")
    .populate("festivalId", "name year");

  if (!contribution) {
    return res.status(404).json(new ApiResponse(404, {}, "Contribution not found"));
  }

  const slipFilePath = contribution.slipPath
    ? path.join(process.cwd(), "public", contribution.slipPath)
    : null;

  // --- Return existing slip if present ---
  if (slipFilePath && fs.existsSync(slipFilePath)) {
    const fileUrl = `${req.protocol}://${req.get("host")}${contribution.slipPath}`;
    await sendWhatsAppReceipt(contribution.contributorId, contribution.festivalId, fileUrl);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { slipPath: contribution.slipPath, slipUrl: fileUrl },
          "Slip already exists",
        ),
      );
  }

  // --- Create new PDF ---
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = height - 60;

  const drawText = (text, x, yPos, fontSize = 12, color = rgb(0, 0, 0), fontToUse = font) => {
    page.drawText(text, { x, y: yPos, size: fontSize, font: fontToUse, color });
  };

  const drawLine = (yPos) => {
    page.drawLine({
      start: { x: 40, y: yPos },
      end: { x: width - 40, y: yPos },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
    });
  };

  // --- Header ---
  drawText(
    `${contribution.festivalId.name} ${contribution.festivalId.year}`,
    150,
    y,
    24,
    rgb(0.85, 0.11, 0.36),
    boldFont,
  );
  y -= 30;
  drawText("Contribution Receipt", 180, y, 16, rgb(0.3, 0.3, 0.3));
  y -= 25;
  drawLine(y);
  y -= 20;

  // --- Contribution Info ---
  drawText(`Receipt No: #${contribution._id.toString().slice(-4)}`, 50, y);
  y -= 20;
  drawText(`Date: ${new Date(contribution.date).toLocaleDateString()}`, 50, y);
  y -= 20;
  const statusColor = contribution.status === "Pending" ? rgb(1, 0.65, 0) : rgb(0, 0.7, 0);
  drawText(`Status: ${contribution.status}`, 50, y, 12, statusColor, boldFont);
  y -= 25;
  drawLine(y);
  y -= 20;

  // --- Contributor Details ---
  drawText("Contributor Details", 50, y, 14, rgb(0.2, 0.2, 0.2), boldFont);
  y -= 20;
  drawText(`Name: ${contribution.contributorId.name}`, 50, y);
  y -= 20;
  drawText(`Address: ${contribution.contributorId.address || "-"}`, 50, y);
  y -= 20;
  drawText(`Category: ${contribution.contributorId.category}`, 50, y);
  y -= 25;
  drawLine(y);
  y -= 20;

  // --- Contribution Details ---
  drawText("Contribution Details", 50, y, 14, rgb(0.2, 0.2, 0.2), boldFont);
  y -= 20;
  drawText(`Type: ${contribution.type}`, 50, y);
  y -= 20;
  if (contribution.type === "cash") {
    drawText(
      `Amount: Rs.${contribution.amount.toLocaleString("en-IN")}`,
      50,
      y,
      12,
      rgb(0.85, 0.11, 0.36),
      boldFont,
    );
  } else {
    drawText(`Item: ${contribution.itemName}`, 50, y);
  }
  y -= 25;
  drawLine(y);
  y -= 30;

  // // --- Footer / Signatures ---
  // drawText("Contributor Signature", 50, y, 12, rgb(0, 0, 0));
  // drawLine(y - 5);
  // drawText("Authorized Signature", width - 250, y, 12, rgb(0, 0, 0));
  // drawLine(width - 250, y - 5);

  // --- Save PDF ---
  const fileId = uuidv4();
  const pdfPath = path.join(process.cwd(), `public/slips/${fileId}.pdf`);
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(pdfPath, pdfBytes);

  // --- Update Contribution ---
  contribution.slipPath = `/slips/${fileId}.pdf`;
  await contribution.save();

  const fileUrl = `${req.protocol}://${req.get("host")}${contribution.slipPath}`;

  // --- Optional WhatsApp ---
  await sendWhatsAppReceipt(contribution.contributorId, contribution.festivalId, fileUrl);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { slipPath: contribution.slipPath, slipUrl: fileUrl },
        "Slip generated successfully",
      ),
    );
});
