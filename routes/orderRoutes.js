import express from "express";
import {
  createOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  downloadInvoice,
  createRazorpayOrder,
  verifyRazorpayPayment,
  cancelOrder,
  createPayLaterOrder,
  createRazorpayOrderForExisting,
} from "../controllers/orderController.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/adminMiddleware.js";

const router = express.Router();

router.post("/", protect, createOrder);
router.post("/razorpay/create", protect, createRazorpayOrder);
router.post("/razorpay/verify", protect, verifyRazorpayPayment);
router.post("/pay-later", protect, createPayLaterOrder);             
router.get("/my", protect, getMyOrders);
router.get("/", protect, adminOnly, getAllOrders);
router.get("/:id", protect, getOrderById);
router.patch("/:id/status", protect, adminOnly, updateOrderStatus);
router.patch("/:id/cancel", protect, cancelOrder);
router.post("/:id/razorpay/create", protect, createRazorpayOrderForExisting); 
router.get("/:id/invoice", protect, downloadInvoice);

export default router;