import express from "express";
import {
  loginUser,
  registerUser,
  getLoggedInUser,
  logOutUser,
  refreshAccessToken,
} from "../controllers/auth.controller.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", verifyJwt, getLoggedInUser);
router.get("/logout", verifyJwt, logOutUser);
router.post("/refresh-accesstoken", refreshAccessToken);

export default router;
