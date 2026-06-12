import mongoose from "mongoose";
import Product from "./models/Product.js";

await mongoose.connect("mongodb://localhost:27017/furniture");
await Product.updateMany({}, { $set: { stock: 100, isActive: true } });
console.log("All products updated");
process.exit();