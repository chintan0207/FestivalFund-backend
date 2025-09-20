import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { v4 as uuidv4 } from "uuid";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { Expense } from "../models/expense.model.js";
import { Contribution } from "../models/contribution.model.js";
import { updateFestivalStats } from "../utils/utility.js";

export const getFestivalReportPdf = asyncHandler(async (req, res) => {
  const { festivalId } = req.params;

  // --- Fetch contributions ---
  const contributions = await Contribution.find({ festivalId })
    .populate("contributorId", "name category")
    .populate("festivalId", "name year");

  // --- Fetch expenses ---
  const expenses = await Expense.find({ festivalId });

  if (!contributions.length && !expenses.length) {
    return res
      .status(404)
      .json(new ApiResponse(404, {}, "No contributions or expenses found for this festival"));
  }

  // --- Get updated stats ---
  const stats = await updateFestivalStats(festivalId);

  // --- Build contribution rows ---
  const contributionRows = contributions
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

  // --- Build expense rows ---
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

  // --- Build expense category totals rows ---
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

  // --- Load template ---
  const htmlTemplate = fs.readFileSync(
    path.join(process.cwd(), "templates/festivalReport.html"),
    "utf-8",
  );

  // --- Replace placeholders ---
  const html = htmlTemplate
    .replace(/{{festivalName}}/g, contributions[0]?.festivalId?.name || "Festival")
    .replace(/{{festivalYear}}/g, contributions[0]?.festivalId?.year || "")
    .replace(/{{openingBalance}}/g, stats.openingBalance.toLocaleString("en-IN"))
    .replace(/{{totalCollected}}/g, stats.totalCollected.toLocaleString("en-IN"))
    .replace(/{{pendingAmount}}/g, stats.pendingAmount.toLocaleString("en-IN"))
    .replace(/{{totalExpenses}}/g, stats.totalExpenses.toLocaleString("en-IN"))
    .replace(/{{currentBalance}}/g, stats.currentBalance.toLocaleString("en-IN"))
    .replace(/{{contributionRows}}/g, contributionRows)
    .replace(/{{expenseRows}}/g, expenseRows)
    .replace(/{{categoryTotalsRows}}/g, categoryTotalsRows);

  // --- Generate PDF ---
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: "/usr/bin/chromium", // or /usr/bin/chromium-browser
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const fileId = uuidv4();
  const pdfPath = path.join(process.cwd(), `public/reports/festival_${fileId}.pdf`);
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });

  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" },
  });

  await browser.close();

  const fileUrl = `${req.protocol}://${req.get("host")}/reports/festival_${fileId}.pdf`;

  return res
    .status(200)
    .json(new ApiResponse(200, { url: fileUrl }, "Festival report PDF generated"));
});

export const exportFestivalReportPdf = asyncHandler(async (req, res) => {
  const { festivalId } = req.params;
  // Later: Generate PDF using puppeteer or PDFKit

  // Placeholder logic
  res.status(200).json(new ApiResponse(200, {}, `PDF exported for festival ${festivalId}`));
});

export const exportContributionsPdf = asyncHandler(async (req, res) => {
  const { festivalId } = req.query;
  const contributions = await Contribution.find({ festivalId }).populate("contributorId", "name");

  // Later: Generate actual PDF and stream or download
  res
    .status(200)
    .json(new ApiResponse(200, contributions, `Contribution PDF for festival ${festivalId}`));
});

export const exportExpensesPdf = asyncHandler(async (req, res) => {
  const { festivalId } = req.query;
  const expenses = await Expense.find({ festivalId });

  // Later: Generate PDF logic
  res.status(200).json(new ApiResponse(200, expenses, `Expenses PDF for festival ${festivalId}`));
});

export const getFestivalStats = asyncHandler(async (req, res) => {
  if (!req.params.festivalId) {
    return res.status(400).json(new ApiResponse(400, {}, "Festival ID is required"));
  }

  const updatedStats = await updateFestivalStats(req.params.festivalId);

  res.status(200).json(new ApiResponse(200, updatedStats, "Festival stats retrieved"));
});
