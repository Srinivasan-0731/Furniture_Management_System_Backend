import asyncHandler from "express-async-handler";
import crypto from "crypto";
import razorpay from "../config/razorpay.js";
import Order from "../models/Order.js";

export const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  const order = await Order.findById(orderId);
  if (!order) { res.status(404); throw new Error("Order not found"); }
  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(order.totalPrice * 100),
    currency: "INR",
    receipt: order.orderNumber,
  });
  res.json({
    success: true,
    data: {
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    },
  });
});

export const verifyPayment = asyncHandler(async (req, res) => {
  const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const generated = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");
  if (generated !== razorpay_signature) {
    res.status(400); throw new Error("Payment verification failed: invalid signature");
  }
  const order = await Order.findById(orderId);
  if (!order) { res.status(404); throw new Error("Order not found"); }
  order.isPaid = true;
  order.orderStatus = "confirmed";
  order.paymentResult = {
    razorpay_order_id, razorpay_payment_id, razorpay_signature,
    status: "paid", paidAt: new Date(),
  };
  await order.save();
  res.json({ success: true, message: "Payment verified successfully", data: order });
});