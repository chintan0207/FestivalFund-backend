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

  // --- Prepare HTML with data ---
  const htmlTemplate = fs.readFileSync(
    path.join(process.cwd(), "templates/contributionSlip.html"),
    "utf-8",
  );

  const html = htmlTemplate
    .replace(/{{festivalName}}/g, contribution.festivalId.name)
    .replace(/{{festivalYear}}/g, contribution.festivalId.year)
    .replace(/{{receiptNo}}/g, contribution._id.toString().slice(-4))
    .replace(/{{date}}/g, new Date(contribution.date).toLocaleDateString("en-IN"))
    .replace(/{{status}}/g, contribution.status)
    .replace(/{{statusClass}}/g, contribution.status === "Pending" ? "pending" : "approved")
    .replace(/{{contributorName}}/g, contribution.contributorId.name)
    .replace(/{{address}}/g, contribution.contributorId.address || "-")
    .replace(/{{category}}/g, contribution.contributorId.category)
    .replace(/{{type}}/g, contribution.type)
    .replace(/{{amount}}/g, contribution.amount?.toLocaleString("en-IN") || "")
    .replace(/{{itemName}}/g, contribution.itemName || "")
    .replace(/{{#ifCash}}([\s\S]*?){{\/ifCash}}/g, contribution.type === "cash" ? "$1" : "")
    .replace(/{{#ifItem}}([\s\S]*?){{\/ifItem}}/g, contribution.type === "item" ? "$1" : "");

  // --- Generate PDF with Puppeteer ---
  const browser = await puppeteer.launch({
    headless: "new", // or true
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const fileId = uuidv4();
  const pdfPath = path.join(process.cwd(), `public/slips/${fileId}.pdf`);
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });

  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "20px", bottom: "20px", left: "30px", right: "30px" },
  });

  await browser.close();

  // --- Update DB ---
  contribution.slipPath = `/slips/${fileId}.pdf`;
  await contribution.save();

  const fileUrl = `${req.protocol}://${req.get("host")}${contribution.slipPath}`;

  // --- Optional WhatsApp send ---
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

export const contributionsPdfByFestival = asyncHandler(async (req, res) => {
  const { festivalId } = req.params;

  const contributions = await Contribution.find({ festivalId })
    .populate("contributorId", "name category")
    .populate("festivalId", "name year");

  if (!contributions.length) {
    return res
      .status(404)
      .json(new ApiResponse(404, {}, "No contributions found for this festival"));
  }

  // --- Get updated stats ---
  const updatedStats = await updateFestivalStats(festivalId);

  // --- Load template ---
  const htmlTemplate = fs.readFileSync(
    path.join(process.cwd(), "templates/contributionsByFestival.html"),
    "utf-8",
  );

  // --- Build rows for contributions ---
  const rows = contributions
    .map((c) => {
      const statusClass =
        c.status === "Deposited" ? "deposited" : c.status === "Pending" ? "pending" : "rejected";

      const amountOrItem =
        c.type === "cash"
          ? `<span class="amount">₹${c.amount?.toLocaleString("en-IN")}</span>`
          : c.itemName;

      return `
        <tr>
          <td>
            <div><strong>${c.contributorId?.name}</strong></div>
            <div style="font-size: 12px; color: #666;">${c.contributorId?.category || ""}</div>
          </td>
          <td>${amountOrItem}</td>
          <td>${new Date(c.date).toLocaleDateString("en-IN")}</td>
          <td><span class="status ${statusClass}">${c.status}</span></td>
        </tr>
      `;
    })
    .join("");

  // --- Replace placeholders in template ---
  const html = htmlTemplate
    .replace(/{{festivalName}}/g, contributions[0].festivalId.name)
    .replace(/{{festivalYear}}/g, contributions[0].festivalId.year)
    .replace(/{{openingBalance}}/g, updatedStats.openingBalance.toLocaleString("en-IN"))
    .replace(/{{totalCollected}}/g, updatedStats.totalCollected.toLocaleString("en-IN"))
    .replace(/{{pendingAmount}}/g, updatedStats.pendingAmount.toLocaleString("en-IN"))
    .replace(/{{totalExpenses}}/g, updatedStats.totalExpenses.toLocaleString("en-IN"))
    .replace(/{{currentBalance}}/g, updatedStats.currentBalance.toLocaleString("en-IN"))
    .replace(/{{rows}}/g, rows);

  // --- Generate PDF with Puppeteer ---
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const fileId = uuidv4();
  const pdfPath = path.join(process.cwd(), `public/reports/contributions_${fileId}.pdf`);
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });

  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" },
  });

  await browser.close();

  const fileUrl = `${req.protocol}://${req.get("host")}/reports/contributions_${fileId}.pdf`;

  return res
    .status(200)
    .json(new ApiResponse(200, { url: fileUrl }, "Festival contributions PDF generated"));
});

