import mongoose from "mongoose";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { Contribution } from "../models/contribution.model.js";
import { updateFestivalStats } from "../utils/utility.js";
import { Contributor } from "../models/contributor.model.js";
import puppeteer from "puppeteer";
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

  // --- Fetch Contribution ---
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

  // --- Load HTML Template ---
  const templatePath = path.join(process.cwd(), "templates/contributionSlip.html");
  if (!fs.existsSync(templatePath)) {
    return res.status(500).json(new ApiResponse(500, {}, "Slip template not found"));
  }

  let html = fs.readFileSync(templatePath, "utf8");

  // --- Replace placeholders ---
  html = html
    .replace("{{festivalName}}", contribution.festivalId.name)
    .replace("{{festivalYear}}", contribution.festivalId.year)
    .replace("{{receiptNo}}", contribution._id.toString().slice(-4))
    .replace("{{date}}", new Date(contribution.date).toLocaleDateString())
    .replace("{{status}}", contribution.status)
    .replace("{{statusClass}}", contribution.status === "Pending" ? "pending" : "approved")
    .replace("{{contributorName}}", contribution.contributorId.name)
    .replace("{{address}}", contribution.contributorId.address || "-")
    .replace("{{category}}", contribution.contributorId.category)
    .replace("{{type}}", contribution.type);

  if (contribution.type === "cash") {
    html = html
      .replace("{{#ifCash}}", "")
      .replace("{{amount}}", contribution.amount.toLocaleString("en-IN"))
      .replace("{{/ifCash}}", "")
      .replace("{{#ifItem}}", "<!--")
      .replace("{{/ifItem}}", "-->");
  } else {
    html = html
      .replace("{{#ifItem}}", "")
      .replace("{{itemName}}", contribution.itemName)
      .replace("{{/ifItem}}", "")
      .replace("{{#ifCash}}", "<!--")
      .replace("{{/ifCash}}", "-->");
  }

  // --- Prepare PDF Path ---
  const fileId = uuidv4();
  const pdfPath = path.join(process.cwd(), `public/slips/${fileId}.pdf`);
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });

  // --- Launch Puppeteer using system Chrome (production-ready) ---
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: "/usr/bin/google-chrome", // must exist on Render
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({ path: pdfPath, format: "A4", printBackground: true });
  } catch (err) {
    throw new Error("Failed to generate PDF: " + err.message);
  } finally {
    await browser.close();
  }

  // --- Update Contribution ---
  contribution.slipPath = `/slips/${fileId}.pdf`;
  await contribution.save();

  const fileUrl = `${req.protocol}://${req.get("host")}${contribution.slipPath}`;

  // --- Optional: Send WhatsApp Receipt ---
  try {
    await sendWhatsAppReceipt(contribution.contributorId, contribution.festivalId, fileUrl);
  } catch (err) {
    console.error("WhatsApp sending error:", err.message);
  }

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
