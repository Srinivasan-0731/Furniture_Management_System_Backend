import asyncHandler from "express-async-handler";
import crypto from "crypto";
import razorpay from "../config/razorpay.js";
import Order from "../models/Order.js";

const assertOwner = (res, order, user) => {
  if (order.user.toString() !== user._id.toString() && user.role !== "admin") {
    res.status(403);
    throw new Error("Not authorized");
  }
};

// POST /api/payments/create
export const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  const order = await Order.findById(orderId);
  if (!order) { res.status(404); throw new Error("Order not found"); }
  assertOwner(res, order, req.user);

  let razorpayOrder;
  try {
    razorpayOrder = await razorpay.orders.create({
      amount: Math.round(order.totalPrice * 100),
      currency: "INR",
      receipt: order.orderNumber || `receipt_${Date.now()}`,
    });
  } catch (err) {
    console.error("Razorpay error:", JSON.stringify(err));
    res.status(502);
    throw new Error(
      err?.error?.description || err?.message || "Razorpay order creation failed"
    );
  }

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

// POST /api/payments/verify
export const verifyPayment = asyncHandler(async (req, res) => {
  const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const generated = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (generated !== razorpay_signature) {
    res.status(400);
    throw new Error("Payment verification failed: invalid signature");
  }

  const order = await Order.findById(orderId);
  if (!order) { res.status(404); throw new Error("Order not found"); }
  assertOwner(res, order, req.user);

  // Order schema-la irukkura fields-a dhaan use pannanum (paymentResult schema-la illa)
  order.isPaid = true;
  order.paymentStatus = "paid";
  order.paymentId = razorpay_payment_id;
  order.orderStatus = "confirmed";
  await order.save();

  res.json({ success: true, message: "Payment verified successfully", data: order });
});