/* eslint-disable no-undef */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../models/User.model.js";
import { DB_NAME } from "../utils/constants.js";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`);
    console.log(`MongoDB connected at: ${process.env.MONGO_URI}/${DB_NAME}`);

    const existingAdmin = await User.findOne({ role: "admin" });

    if (!existingAdmin) {
      await User.create({
        name: "Admin User",
        email: "admin@festivalfund.com",
        password: "admin123",
        role: "admin",
      });

      console.log("🚀 Default admin created: admin@festivalfund.com / admin123");
    }
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

export default connectDB;
