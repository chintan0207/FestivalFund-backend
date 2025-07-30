import express from "express";
import { loginUser, registerUser, getLoggedInUser } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", getLoggedInUser);

export default router;
