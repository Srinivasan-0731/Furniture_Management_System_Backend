import express from "express";
import cors from "cors";
import "dotenv/config";
import connectDB from "./config/db.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Routes Import
import authRouter      from "./routes/authRoutes.js";
import userRouter      from "./routes/userRoutes.js";
import categoryRouter  from "./routes/categoryRoutes.js";
import productRouter   from "./routes/productRoutes.js";
import cartRouter      from "./routes/cartRoutes.js";       // ✅ இருக்கா?
import orderRouter     from "./routes/orderRoutes.js";
import paymentRouter   from "./routes/paymentRoutes.js";
import dashboardRouter from "./routes/dashboardRoutes.js";

const app  = express();
const port = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

connectDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: function (origin, callback) { callback(null, true); }, credentials: true }));
app.use("/uploads", express.static(join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.json({ message: "Furniture Management System API is Live!" });
});

app.use("/api/auth",       authRouter);
app.use("/api/users",      userRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/products",   productRouter);
app.use("/api/cart",       cartRouter);        
app.use("/api/orders",     orderRouter);
app.use("/api/payments",   paymentRouter);
app.use("/api/dashboard",  dashboardRouter);

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message || "Server error", stack: err.stack });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});