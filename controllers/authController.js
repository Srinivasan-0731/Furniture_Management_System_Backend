import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";

// POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { name, password, phone } = req.body;
  const email = req.body.email?.toLowerCase().trim();

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Please provide name, email and password");
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error("User already exists with this email");
  }

  // SECURITY: body-la irundhu role edukka koodadhu (yaarum admin aagidalaam).
  // Admin venum na .env-la ADMIN_EMAIL=unga@email.com vechukonga,
  // illa MongoDB Atlas-la role-a "admin" nu maathunga.
  const role =
    process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL.toLowerCase()
      ? "admin"
      : "user";

  const user = await User.create({ name, email, password, phone, role });

  res.status(201).json({
    success: true,
    message: "Registration successful",
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    },
  });
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const email = req.body.email?.toLowerCase().trim();

  if (!email || !password) {
    res.status(400);
    throw new Error("Please provide email and password");
  }

  const user = await User.findOne({ email }).select("+password");

  // Same message rendu case-kum (email irukka illa nu theriya koodadhu)
  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  if (!user.isActive) {
    res.status(403);
    throw new Error("Account is deactivated. Contact support.");
  }

  res.json({
    success: true,
    message: "Login successful",
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      avatar: user.avatar,
      token: generateToken(user._id),
    },
  });
});

// GET /api/auth/me
export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({ success: true, data: user });
});

// POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  res.json({ success: true, message: "Logged out successfully" });
});