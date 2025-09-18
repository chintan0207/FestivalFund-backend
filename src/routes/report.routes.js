import express from "express";
import {
  exportFestivalReportPdf,
  exportContributionsPdf,
  exportExpensesPdf,
  getFestivalStats,
  getFestivalReportPdf,
} from "../controllers/report.controller.js";

const router = express.Router();

router.get("/festival/:festivalId", getFestivalReportPdf);
router.get("/festival/:festivalId/pdf", exportFestivalReportPdf);
router.get("/contributions/pdf", exportContributionsPdf);
router.get("/expenses/pdf", exportExpensesPdf);
router.get("/festival/:festivalId/stats", getFestivalStats);

export default router;
