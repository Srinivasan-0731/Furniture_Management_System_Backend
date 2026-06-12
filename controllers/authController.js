import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role } = req.body; 
  if (!name || !email || !password) {
    res.status(400); throw new Error("Please provide name, email and password");
  }
  const userExists = await User.findOne({ email });
  if (userExists) { res.status(400); throw new Error("User already exists with this email"); }
  
  const user = await User.create({ name, email, password, phone, role: role || 'admin' }); 
  
  res.status(201).json({ success: true, message: "Registration successful",
    data: { _id: user._id, name: user.name, email: user.email, role: user.role, token: generateToken(user._id) }
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400); throw new Error("Please provide email and password");
  }

  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    res.status(401); throw new Error("No user found with this email");
  }

  
  console.log("User found:", user.email);
  console.log("Stored password hash:", user.password);
  console.log("Entered password:", password);

  const isMatch = await user.comparePassword(password);
  console.log("Password match:", isMatch);

  if (!isMatch) {
    res.status(401); throw new Error("Wrong password");
  }

  if (!user.isActive) {
    res.status(403); throw new Error("Account is deactivated. Contact support.");
  }

  res.json({
    success: true,
    message: "Login successful",
    data: {
      _id: user._id, name: user.name, email: user.email,
      role: user.role, phone: user.phone, avatar: user.avatar,
      token: generateToken(user._id)
    }
  });
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({ success: true, data: user });
});

export const logout = asyncHandler(async (req, res) => {
  res.json({ success: true, message: "Logged out successfully" });
});