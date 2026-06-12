import asyncHandler from "express-async-handler";
import crypto from "crypto";
import Razorpay from "razorpay";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── Helper: build order items from cart ──────────────────────
const buildOrderItemsFromCart = async (userId) => {
  const cart = await Cart.findOne({ user: userId }).populate("items.product");
  if (!cart || cart.items.length === 0) throw new Error("Cart is empty");

  const orderItems = [];
  let itemsPrice = 0;

  for (const item of cart.items) {
    const product = item.product;
    if (!product) continue;
    if (product.stock < item.quantity) {
      throw new Error(`Insufficient stock for ${product.name}`);
    }
    orderItems.push({
      product: product._id,
      name: product.name,
      quantity: item.quantity,
      price: product.discountPrice || product.price,
      image: product.images?.[0] || "",
    });
    itemsPrice += (product.discountPrice || product.price) * item.quantity;
  }

  const shippingPrice = itemsPrice > 5000 ? 0 : 199;
  const taxPrice = parseFloat((itemsPrice * 0.18).toFixed(2));
  const totalPrice = parseFloat((itemsPrice + shippingPrice + taxPrice).toFixed(2));

  return { cart, orderItems, itemsPrice, shippingPrice, taxPrice, totalPrice };
};

// ── Deduct stock & clear cart ─────────────────────────────────
const deductStockAndClearCart = async (cart, userId) => {
  for (const item of cart.items) {
    await Product.findByIdAndUpdate(item.product._id || item.product, {
      $inc: { stock: -item.quantity },
    });
  }
  await Cart.findOneAndUpdate({ user: userId }, { $set: { items: [] } });
};

// ─────────────────────────────────────────────────────────────
// 1. CREATE ORDER (COD fallback — kept for compatibility)
// ─────────────────────────────────────────────────────────────
export const createOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, paymentMethod } = req.body;

  const { cart, orderItems, itemsPrice, shippingPrice, taxPrice, totalPrice } =
    await buildOrderItemsFromCart(req.user._id).catch((err) => {
      res.status(400);
      throw err;
    });

  await deductStockAndClearCart(cart, req.user._id);

  const order = await Order.create({
    user: req.user._id,
    items: orderItems,
    shippingAddress,
    paymentMethod: paymentMethod || "cod",
    itemsPrice,
    shippingPrice,
    taxPrice,
    totalPrice,
    orderStatus: "pending",
    orderNumber: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  });

  res.status(201).json({ success: true, data: order });
});

// ─────────────────────────────────────────────────────────────
// 2. CREATE RAZORPAY ORDER (Pay Now from Cart)
// ─────────────────────────────────────────────────────────────
export const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, amount } = req.body;

  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency: "INR",
    receipt: `receipt_${Date.now()}`,
  });

  // Fetch cart items to save in order
  const { cart, orderItems, itemsPrice, shippingPrice, taxPrice } =
    await buildOrderItemsFromCart(req.user._id).catch((err) => {
      res.status(400);
      throw err;
    });

  const order = await Order.create({
    user: req.user._id,
    items: orderItems,
    shippingAddress,
    paymentMethod: "razorpay",
    paymentStatus: "pending",
    itemsPrice,
    shippingPrice,
    taxPrice,
    totalPrice: amount,
    orderStatus: "pending",
    orderNumber: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  });

  // Deduct stock & clear cart immediately
  await deductStockAndClearCart(cart, req.user._id);

  res.json({
    success: true,
    data: {
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      orderId: order._id,
    },
  });
});

// ─────────────────────────────────────────────────────────────
// 3. VERIFY RAZORPAY PAYMENT
// ─────────────────────────────────────────────────────────────
export const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  const sign = razorpayOrderId + "|" + razorpayPaymentId;
  const expectedSign = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(sign)
    .digest("hex");

  if (expectedSign !== razorpaySignature) {
    res.status(400);
    throw new Error("Payment verification failed");
  }

  await Order.findByIdAndUpdate(orderId, {
    isPaid: true,
    paymentStatus: "paid",
    paymentId: razorpayPaymentId,
    orderStatus: "confirmed",
  });

  res.json({ success: true, message: "Payment verified" });
});

// ─────────────────────────────────────────────────────────────
// 4. PAY LATER — save order as pending, pay from MyOrders
// ─────────────────────────────────────────────────────────────
export const createPayLaterOrder = asyncHandler(async (req, res) => {
  const { shippingAddress } = req.body;

  const { cart, orderItems, itemsPrice, shippingPrice, taxPrice, totalPrice } =
    await buildOrderItemsFromCart(req.user._id).catch((err) => {
      res.status(400);
      throw err;
    });

  await deductStockAndClearCart(cart, req.user._id);

  const order = await Order.create({
    user: req.user._id,
    items: orderItems,
    shippingAddress,
    paymentMethod: "razorpay",
    paymentStatus: "pending",
    itemsPrice,
    shippingPrice,
    taxPrice,
    totalPrice,
    orderStatus: "pending",
    orderNumber: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  });

  res.status(201).json({ success: true, data: order });
});

// ─────────────────────────────────────────────────────────────
// 5. CREATE RAZORPAY ORDER FOR EXISTING PENDING ORDER (MyOrders Pay Now)
// ─────────────────────────────────────────────────────────────
export const createRazorpayOrderForExisting = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) { res.status(404); throw new Error("Order not found"); }
  if (order.user.toString() !== req.user._id.toString()) {
    res.status(403); throw new Error("Not authorized");
  }
  if (order.paymentStatus === "paid") {
    res.status(400); throw new Error("Order already paid");
  }

  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(order.totalPrice * 100),
    currency: "INR",
    receipt: `receipt_${Date.now()}`,
  });

  res.json({
    success: true,
    data: {
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      orderId: order._id,
    },
  });
});

// ─────────────────────────────────────────────────────────────
// 6. GET MY ORDERS
// ─────────────────────────────────────────────────────────────
export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: orders });
});

// ─────────────────────────────────────────────────────────────
// 7. GET ORDER BY ID
// ─────────────────────────────────────────────────────────────
export const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate("user", "name email");
  if (!order) { res.status(404); throw new Error("Order not found"); }

  const isOwner = order.user._id.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";
  if (!isOwner && !isAdmin) { res.status(403); throw new Error("Not authorized"); }

  res.json({ success: true, data: order });
});

// ─────────────────────────────────────────────────────────────
// 8. GET ALL ORDERS (Admin)
// ─────────────────────────────────────────────────────────────
export const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({})
    .populate("user", "name email")
    .sort({ createdAt: -1 });
  res.json({ success: true, data: orders });
});

// ─────────────────────────────────────────────────────────────
// 9. UPDATE ORDER STATUS (Admin)
// ─────────────────────────────────────────────────────────────
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) { res.status(404); throw new Error("Order not found"); }

  order.orderStatus = status;
  if (status === "delivered") {
    order.isDelivered = true;
    order.deliveredAt = new Date();
  }
  await order.save();

  res.json({ success: true, data: order });
});

// ─────────────────────────────────────────────────────────────
// 10. CANCEL ORDER
// ─────────────────────────────────────────────────────────────
export const cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) { res.status(404); throw new Error("Order not found"); }

  const isOwner = order.user.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";
  if (!isOwner && !isAdmin) { res.status(403); throw new Error("Not authorized"); }

  if (!["pending", "confirmed"].includes(order.orderStatus)) {
    res.status(400);
    throw new Error("Order cannot be cancelled at this stage");
  }

  // Restore stock
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { stock: item.quantity },
    });
  }

  order.orderStatus = "cancelled";
  order.cancelReason = req.body.reason || "Cancelled by user";
  await order.save();

  res.json({ success: true, data: order });
});

// ─────────────────────────────────────────────────────────────
// 11. DOWNLOAD INVOICE
// ─────────────────────────────────────────────────────────────
export const downloadInvoice = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate("user", "name email");
  if (!order) { res.status(404); throw new Error("Order not found"); }

  const isOwner = order.user._id.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";
  if (!isOwner && !isAdmin) { res.status(403); throw new Error("Not authorized"); }

  // Simple text invoice — replace with PDF generation if needed
  const lines = [
    `INVOICE`,
    `Order #: ${order.orderNumber || order._id}`,
    `Date: ${new Date(order.createdAt).toLocaleDateString("en-IN")}`,
    `Customer: ${order.user.name} (${order.user.email})`,
    ``,
    `ITEMS:`,
    ...order.items.map(
      (i) => `  ${i.name} x${i.quantity} @ ₹${i.price} = ₹${(i.price * i.quantity).toFixed(2)}`
    ),
    ``,
    `Items Total : ₹${order.itemsPrice?.toFixed(2)}`,
    `Shipping    : ${order.shippingPrice === 0 ? "Free" : `₹${order.shippingPrice}`}`,
    `Tax (18%)   : ₹${order.taxPrice?.toFixed(2)}`,
    `TOTAL       : ₹${order.totalPrice?.toFixed(2)}`,
    ``,
    `Payment     : ${order.paymentStatus}`,
    `Status      : ${order.orderStatus}`,
  ].join("\n");

  res.setHeader("Content-Type", "text/plain");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="invoice-${order.orderNumber || order._id}.txt"`
  );
  res.send(lines);
});