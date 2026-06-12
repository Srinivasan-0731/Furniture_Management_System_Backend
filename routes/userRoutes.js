import express from "express";
import { getAllUsers, getUserById, updateProfile, changePassword, toggleUserStatus } from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/adminMiddleware.js";
import { uploadSingle } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.get("/", protect, adminOnly, getAllUsers);
router.get("/:id", protect, adminOnly, getUserById);
router.put("/profile", protect, uploadSingle, updateProfile);
router.put("/change-password", protect, changePassword);
router.patch("/:id/toggle-status", protect, adminOnly, toggleUserStatus);

export default router;