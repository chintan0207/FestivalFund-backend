import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { v4 as uuidv4 } from "uuid";
import { Expense } from "../models/expense.model.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { updateFestivalStats } from "../utils/utility.js";

export const createExpense = asyncHandler(async (req, res) => {
  const { festivalId, category, amount, description, date } = req.body;

  if (!festivalId || !category || !amount) {
    throw new ApiError(400, "festivalId, category, and amount are required");
  }

  const expense = await Expense.create({
    festivalId,
    category,
    amount,
    description,
    date,
  });

  const updatedStats = await updateFestivalStats(festivalId);

  res
    .status(201)
    .json(
      new ApiResponse(
        201,
        { expense, festivalStats: updatedStats },
        "Expense created successfully",
      ),
    );
});

export const getAllExpenses = asyncHandler(async (req, res) => {
  let {
    page,
    limit,
    sortOrder = "desc",
    sortField = "createdAt",
    festivalId,
    search = "",
    category,
    dateRange, // today | this_week | this_month
  } = req.query;

  const sortDirection = sortOrder === "asc" ? 1 : -1;
  const usePagination = page !== undefined && limit !== undefined;
  const pageNumber = usePagination ? parseInt(page) : 1;
  const limitNumber = usePagination ? parseInt(limit) : 0;
  const skip = (pageNumber - 1) * limitNumber;

  const matchStage = {};

  if (search) {
    matchStage.$or = [
      { category: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  if (category && category !== "All") {
    matchStage.category = category;
  }

  if (festivalId) {
    matchStage.festivalId = new mongoose.Types.ObjectId(festivalId);
  }

  if (dateRange) {
    const now = new Date();
    let startDate;

    if (dateRange === "today") {
      startDate = new Date(now.setHours(0, 0, 0, 0));
    } else if (dateRange === "this_week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday
      startDate = new Date(now.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
    } else if (dateRange === "this_month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    if (startDate) {
      matchStage.date = { $gte: startDate };
    }
  }

  const pipeline = [
    { $match: matchStage },
    {
      $lookup: {
        from: "festivals",
        localField: "festivalId",
        foreignField: "_id",
        as: "festival",
      },
    },
    { $unwind: { path: "$festival", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        category: 1,
        amount: 1,
        description: 1,
        date: 1,
        createdAt: 1,
        updatedAt: 1,
        "festival.name": 1,
        "festival.year": 1,
      },
    },
    { $sort: { [sortField]: sortDirection } },
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

  const result = await Expense.aggregate(pipeline).collation({ locale: "en", strength: 2 });

  let expenses, paginationData;

  if (usePagination) {
    const { metaData = [], data = [] } = result[0] || {};
    expenses = data;
    paginationData = metaData[0] || {
      total: 0,
      page: pageNumber,
      limit: limitNumber,
      totalPages: 0,
    };
  } else {
    expenses = result;
    paginationData = {
      total: expenses.length,
      page: 1,
      limit: expenses.length,
      totalPages: 1,
    };
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { expenses, ...paginationData },
        expenses.length > 0 ? "Expenses fetched " : "No expenses found",
      ),
    );
});

export const getExpenseById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const expense = await Expense.findById(id).populate("festivalId", "name year");

  if (!expense) {
    throw new ApiError(404, "Expense not found");
  }

  res.status(200).json(new ApiResponse(200, expense, "Fetched expense"));
});

export const updateExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { category, amount, description, date } = req.body;

  const expense = await Expense.findById(id);
  if (!expense) {
    throw new ApiError(404, "Expense not found");
  }

  // Update only provided fields
  if (category !== undefined) expense.category = category;
  if (amount !== undefined) expense.amount = amount;
  if (description !== undefined) expense.description = description;
  if (date !== undefined) expense.date = date;

  await expense.save();

  const updatedStats = await updateFestivalStats(expense.festivalId);

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { expense, festivalStats: updatedStats },
        "Expense updated successfully",
      ),
    );
});

export const deleteExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const expense = await Expense.findById(id);
  if (!expense) {
    throw new ApiError(404, "Expense not found");
  }

  const festivalId = expense.festivalId;

  await expense.deleteOne();

  const updatedStats = await updateFestivalStats(festivalId);

  res
    .status(200)
    .json(new ApiResponse(200, { festivalStats: updatedStats }, "Expense deleted successfully"));
});

export const expensesPdfByFestival = asyncHandler(async (req, res) => {
  const { festivalId } = req.params;

  // --- Fetch expenses ---
  const expenses = await Expense.find({ festivalId });

  if (!expenses.length) {
    return res.status(404).json(new ApiResponse(404, {}, "No expenses found for this festival"));
  }

  // --- Get updated stats (includes categoryTotals) ---
  const stats = await updateFestivalStats(festivalId);

  // --- Load template ---
  const htmlTemplate = fs.readFileSync(
    path.join(process.cwd(), "templates/expensesByFestival.html"),
    "utf-8",
  );

  // --- Build rows for expenses ---
  const expenseRows = expenses
    .map(
      (e) => `
    <tr>
      <td>${e.category}</td>
      <td class="amount">₹${e.amount.toLocaleString("en-IN")}</td>
      <td>${new Date(e.date).toLocaleDateString("en-IN")}</td>
      <td>${e.description || "-"}</td>
    </tr>
  `,
    )
    .join("");

  // --- Build category totals rows ---
  const categoryTotalsRows = Object.entries(stats.categoryTotals || {})
    .map(
      ([category, total]) => `
    <tr>
      <td>${category}</td>
      <td class="amount">₹${total.toLocaleString("en-IN")}</td>
    </tr>
  `,
    )
    .join("");

  // --- Replace placeholders ---
  const html = htmlTemplate
    .replace(/{{festivalName}}/g, expenses[0]?.festivalId?.name || "Festival")
    .replace(/{{festivalYear}}/g, expenses[0]?.festivalId?.year || "")
    .replace(/{{openingBalance}}/g, stats.openingBalance.toLocaleString("en-IN"))
    .replace(/{{totalCollected}}/g, stats.totalCollected.toLocaleString("en-IN"))
    .replace(/{{pendingAmount}}/g, stats.pendingAmount.toLocaleString("en-IN"))
    .replace(/{{totalExpenses}}/g, stats.totalExpenses.toLocaleString("en-IN"))
    .replace(/{{currentBalance}}/g, stats.currentBalance.toLocaleString("en-IN"))
    .replace(/{{expenseRows}}/g, expenseRows)
    .replace(/{{categoryTotalsRows}}/g, categoryTotalsRows);

  // --- Generate PDF ---
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const fileId = uuidv4();
  const pdfPath = path.join(process.cwd(), `public/reports/expenses_${fileId}.pdf`);
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });

  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" },
  });

  await browser.close();

  const fileUrl = `${req.protocol}://${req.get("host")}/reports/expenses_${fileId}.pdf`;

  return res
    .status(200)
    .json(new ApiResponse(200, { url: fileUrl }, "Festival expense PDF generated"));
});
