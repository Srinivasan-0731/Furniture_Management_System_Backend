import express from "express";
import {
  getAllProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  deleteProductImage,
  addReview,
  seedProducts,
} from "../controllers/productController.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/adminMiddleware.js";
import { uploadMultiple } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.get("/",               getAllProducts);
router.post("/seed/data",     seedProducts);          
router.get("/:id",            getProduct);
router.post("/",              protect, adminOnly, uploadMultiple, createProduct);
router.put("/:id",            protect, adminOnly, uploadMultiple, updateProduct);
router.delete("/:id/image",   protect, adminOnly, deleteProductImage);
router.delete("/:id",         protect, adminOnly, deleteProduct);
router.post("/:id/reviews",   protect, addReview);

export default router;