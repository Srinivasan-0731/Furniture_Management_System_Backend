import asyncHandler from "express-async-handler";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

export const getCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id }).populate("items.product", "name price image");
  if (!cart) {
    return res.json({ success: true, data: { items: [], total: 0 } });
  }
  res.json({ success: true, data: cart });
});

export const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;
  if (!productId || !quantity) {
    res.status(400);
    throw new Error("Product ID and quantity are required");
  }
  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  if (product.stock < quantity) {
    res.status(400);
    throw new Error("Insufficient stock");
  }
  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    cart = new Cart({
      user: req.user._id,
      items: [{ product: productId, quantity, price: product.price }]
    });
  } else {
    const itemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );
    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += quantity;
    } else {
      cart.items.push({ product: productId, quantity, price: product.price });
    }
  }
  cart.total = cart.items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  await cart.save();
  res.json({ success: true, data: cart });
});

export const updateCartItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  if (!quantity || quantity < 1) {
    res.status(400);
    throw new Error("Valid quantity is required");
  }
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    res.status(404);
    throw new Error("Cart not found");
  }
  const itemIndex = cart.items.findIndex(
    item => item.product.toString() === req.params.productId
  );
  if (itemIndex === -1) {
    res.status(404);
    throw new Error("Item not found in cart");
  }
  cart.items[itemIndex].quantity = quantity;
  cart.total = cart.items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  await cart.save();
  res.json({ success: true, data: cart });
});

export const removeFromCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    res.status(404);
    throw new Error("Cart not found");
  }
  cart.items = cart.items.filter(
    item => item.product.toString() !== req.params.productId
  );
  cart.total = cart.items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  await cart.save();
  res.json({ success: true, data: cart });
});

export const clearCart = asyncHandler(async (req, res) => {
  await Cart.findOneAndDelete({ user: req.user._id });
  res.json({ success: true, message: "Cart cleared" });
});