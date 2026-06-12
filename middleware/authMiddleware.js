import jwt from "jsonwebtoken";
import User from "../models/User.js";
import asyncHandler from "express-async-handler";

export const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    res.status(401);
    throw new Error("Not authorized, no token");
  }

  
  console.log("Token:", token);
  console.log("JWT_SECRET:", process.env.JWT_SECRET);

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded:", decoded); 
  } catch (error) {
    console.log("JWT Error:", error.message); 
    res.status(401);
    throw new Error("Not authorized, token failed");
  }

  req.user = await User.findById(decoded.id).select("-password");

  if (!req.user) {
    res.status(401);
    throw new Error("User not found");
  }

  if (!req.user.isActive) {
    res.status(401);
    throw new Error("Account deactivated");
  }

  next();
});