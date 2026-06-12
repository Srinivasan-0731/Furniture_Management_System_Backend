import express from "express";
import { getCategories, getCategoryById, createCategory, updateCategory, deleteCategory } from "../controllers/categoryController.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/adminMiddleware.js";
import { uploadSingle } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.get("/", getCategories);
router.get("/:id", getCategoryById);
router.post("/", protect, adminOnly, uploadSingle, createCategory);
router.put("/:id", protect, adminOnly, uploadSingle, updateCategory);
router.delete("/:id", protect, adminOnly, deleteCategory);

export default router;