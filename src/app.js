import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { globalErrorHandler } from "./utils/global-error-handler.js";
import path from "path";


// Routes
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import festivalRoutes from "./routes/festival.routes.js";
import contributorRoutes from "./routes/contributor.routes.js";
import contributionRoutes from "./routes/contribution.routes.js";
import expenseRoutes from "./routes/expense.routes.js";
import reportRoutes from "./routes/report.routes.js";


const app = express();
const allowedOrigins = ["http://localhost:5173", "https://festivalfund-frontend.onrender.com"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/slips", express.static(path.join(process.cwd(), "public/slips")));
app.use("/reports", express.static(path.join(process.cwd(), "public/reports")));


app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Festival Fund API is running 🚀",
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/festivals", festivalRoutes);
app.use("/api/contributors", contributorRoutes);
app.use("/api/contributions", contributionRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/reports", reportRoutes);

// Global Error Handler
app.use(globalErrorHandler);

export default app;
