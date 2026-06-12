import asyncHandler from "express-async-handler";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Category from "../models/Category.js";

export const getDashboardStats = asyncHandler(async (req, res) => {
  const [totalOrders, totalProducts, totalUsers, totalCategories] = await Promise.all([
    Order.countDocuments(), Product.countDocuments({ isActive: true }),
    User.countDocuments({ role: "user" }), Category.countDocuments({ isActive: true }),
  ]);
  const revenueResult = await Order.aggregate([{ $match: { isPaid: true } }, { $group: { _id: null, total: { $sum: "$totalPrice" } } }]);
  const totalRevenue = revenueResult[0]?.total || 0;
  const ordersByStatus = await Order.aggregate([{ $group: { _id: "$orderStatus", count: { $sum: 1 } } }]);
  const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const monthlyRevenue = await Order.aggregate([
    { $match: { isPaid: true, createdAt: { $gte: sixMonthsAgo } } },
    { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, revenue: { $sum: "$totalPrice" }, orders: { $sum: 1 } } },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);
  const topProducts = await Order.aggregate([
    { $unwind: "$items" },
    { $group: { _id: "$items.product", name: { $first: "$items.name" }, totalSold: { $sum: "$items.quantity" } } },
    { $sort: { totalSold: -1 } }, { $limit: 5 },
  ]);
  const recentOrders = await Order.find().populate("user", "name email").sort("-createdAt").limit(5);
  res.json({ success: true, data: { counts: { totalOrders, totalProducts, totalUsers, totalCategories }, totalRevenue, ordersByStatus, monthlyRevenue, topProducts, recentOrders } });
});