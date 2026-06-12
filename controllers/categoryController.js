import asyncHandler from "express-async-handler";
import Category from "../models/Category.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const getCategories = asyncHandler(async (req, res) => {
  const filter = req.query.all === "true" ? {} : { isActive: true };
  const categories = await Category.find(filter).sort("name");
  res.json({ success: true, count: categories.length, data: categories });
});

export const getCategoryById = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) { res.status(404); throw new Error("Category not found"); }
  res.json({ success: true, data: category });
});

export const createCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name) { res.status(400); throw new Error("Category name is required"); }
  const categoryData = { name, description };
  if (req.file) categoryData.image = `/uploads/${req.file.filename}`;
  const category = await Category.create(categoryData);
  res.status(201).json({ success: true, message: "Category created", data: category });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) { res.status(404); throw new Error("Category not found"); }
  const { name, description, isActive } = req.body;
  if (name) category.name = name;
  if (description !== undefined) category.description = description;
  if (isActive !== undefined) category.isActive = isActive;
  if (req.file) {
    if (category.image) {
      const oldPath = path.join(__dirname, "..", category.image);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    category.image = `/uploads/${req.file.filename}`;
  }
  const updated = await category.save();
  res.json({ success: true, message: "Category updated", data: updated });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) { res.status(404); throw new Error("Category not found"); }
  if (category.image) {
    const imgPath = path.join(__dirname, "..", category.image);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }
  res.json({ success: true, message: "Category deleted" });
});