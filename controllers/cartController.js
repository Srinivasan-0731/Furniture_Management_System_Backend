import asyncHandler from "express-async-handler";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

// Order controller-oda same price rule: discountPrice irundha adhu, illa na price
const unitPrice = (product) =>
  product.discountPrice > 0 ? product.discountPrice : product.price;

const calcTotal = (cart) =>
  cart.items.reduce((acc, item) => acc + item.price * item.quantity, 0);

// GET /api/cart
export const getCart = asyncHandler(async (req, res) => {
  // "images" (not "image") + discountPrice + stock venum
  const cart = await Cart.findOne({ user: req.user._id }).populate(
    "items.product",
    "name price discountPrice images stock"
  );

  if (!cart) {
    return res.json({ success: true, data: { items: [], totalPrice: 0 } });
  }
  res.json({ success: true, data: cart });
});

// POST /api/cart
export const addToCart = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const quantity = Number(req.body.quantity);

  if (!productId || !quantity || quantity < 1) {
    res.status(400);
    throw new Error("Product ID and quantity are required");
  }

  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  let cart = await Cart.findOne({ user: req.user._id });
  const existingQty =
    cart?.items.find((i) => i.product.toString() === productId)?.quantity || 0;

  if (product.stock < existingQty + quantity) {
    res.status(400);
    throw new Error("Insufficient stock");
  }

  if (!cart) {
    cart = new Cart({
      user: req.user._id,
      items: [{ product: productId, quantity, price: unitPrice(product) }],
    });
  } else {
    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );
    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += quantity;
      cart.items[itemIndex].price = unitPrice(product);
    } else {
      cart.items.push({ product: productId, quantity, price: unitPrice(product) });
    }
  }

  cart.totalPrice = calcTotal(cart);
  await cart.save();
  res.json({ success: true, data: cart });
});

// PUT /api/cart/:productId   (illa PUT /api/cart  body-la productId)
export const updateCartItem = asyncHandler(async (req, res) => {
  const productId = req.params.productId || req.body.productId;
  const quantity = Number(req.body.quantity);

  if (!productId) {
    res.status(400);
    throw new Error("Product ID is required");
  }
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
    (item) => item.product.toString() === productId
  );
  if (itemIndex === -1) {
    res.status(404);
    throw new Error("Item not found in cart");
  }

  const product = await Product.findById(productId);
  if (product && product.stock < quantity) {
    res.status(400);
    throw new Error("Insufficient stock");
  }

  cart.items[itemIndex].quantity = quantity;
  cart.totalPrice = calcTotal(cart);
  await cart.save();
  res.json({ success: true, data: cart });
});

// DELETE /api/cart/:productId
export const removeFromCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    res.status(404);
    throw new Error("Cart not found");
  }

  cart.items = cart.items.filter(
    (item) => item.product.toString() !== req.params.productId
  );
  cart.totalPrice = calcTotal(cart);
  await cart.save();
  res.json({ success: true, data: cart });
});

// DELETE /api/cart
export const clearCart = asyncHandler(async (req, res) => {
  await Cart.findOneAndDelete({ user: req.user._id });
  res.json({ success: true, message: "Cart cleared" });
});