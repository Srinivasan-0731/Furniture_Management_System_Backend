import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "missing_key_id",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "missing_key_secret",
});

export default razorpay;