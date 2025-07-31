import express from "express";
import {
  getFestivalReport,
  exportFestivalReportPdf,
  exportContributionsPdf,
  exportExpensesPdf,
  getFestivalStats,
} from "../controllers/report.controller.js";

const router = express.Router();

router.get("/festival/:festivalId", getFestivalReport);
router.get("/festival/:festivalId/pdf", exportFestivalReportPdf);
router.get("/contributions/pdf", exportContributionsPdf);
router.get("/expenses/pdf", exportExpensesPdf);
router.get("/festival/:festivalId/stats", getFestivalStats);

export default router;
