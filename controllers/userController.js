import asyncHandler from "express-async-handler";
import User from "../models/User.js";

export const getAllUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const total = await User.countDocuments();
  const users = await User.find().select("-password").sort("-createdAt").skip(skip).limit(limit);
  res.json({ success: true, data: users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");
  if (!user) { res.status(404); throw new Error("User not found"); }
  res.json({ success: true, data: user });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) { res.status(404); throw new Error("User not found"); }
  const { name, phone, address } = req.body;
  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (address) user.address = address;
  if (req.file) user.avatar = `/uploads/${req.file.filename}`;
  const updated = await user.save();
  res.json({
    success: true, message: "Profile updated successfully",
    data: { _id: updated._id, name: updated.name, email: updated.email, phone: updated.phone, avatar: updated.avatar, address: updated.address }
  });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.comparePassword(currentPassword))) { res.status(400); throw new Error("Current password is incorrect"); }
  user.password = newPassword;
  await user.save();
  res.json({ success: true, message: "Password changed successfully" });
});

export const toggleUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) { res.status(404); throw new Error("User not found"); }
  user.isActive = !user.isActive;
  await user.save();
  res.json({ success: true, message: `User ${user.isActive ? "activated" : "deactivated"} successfully`, data: { isActive: user.isActive } });
});