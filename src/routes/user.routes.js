import express from "express";
import { getAllUsers, createUser, updateUser, deleteUser } from "../controllers/user.controller.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", verifyJwt, getAllUsers);
router.post("/", verifyJwt, createUser);
router.patch("/:id", verifyJwt, updateUser);
router.delete("/:id", verifyJwt, deleteUser);

export default router;
