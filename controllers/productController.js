import Product from '../models/Product.js';
import Category from '../models/Category.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// GET /api/products
const getAllProducts = async (req, res) => {
  try {
    const { category, search, featured, minPrice, maxPrice, sort, limit = 12, page = 1 } = req.query;

    let query = { isActive: true };
    if (category) query.category = category;
    if (featured) query.isFeatured = featured === 'true';
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if (search) {
      query.$or = [
        { name:        { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { material:    { $regex: search, $options: 'i' } },
      ];
    }

    const sortOptions = {
      newest:       '-createdAt',
      oldest:       'createdAt',
      'price-asc':  'price',
      'price-desc': '-price',
      rating:       '-rating',
    };
    const sortBy = sortOptions[sort] || '-createdAt';

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('category', 'name slug')
      .sort(sortBy)
      .limit(Number(limit))
      .skip(skip);

    res.json({
      success: true,
      count: products.length,
      total,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      data: products,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/products/:id
const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name slug')
      .populate('reviews.user', 'name avatar');
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/products
const createProduct = async (req, res) => {
  try {
    const { name, description, price, discountPrice, category, stock, material, color, tags, dimensions, deliveryDays, isFeatured } = req.body;

    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({ success: false, error: 'Invalid category' });
    }

    const images = req.files ? req.files.map((f) => `/uploads/${f.filename}`) : [];

    const product = await Product.create({
      name, description,
      price: Number(price),
      discountPrice: discountPrice ? Number(discountPrice) : 0,
      category, stock: Number(stock) || 0, images, material,
      color: color ? (Array.isArray(color) ? color : color.split(',')) : [],
      tags:  tags  ? (Array.isArray(tags)  ? tags  : tags.split(','))  : [],
      dimensions: dimensions ? JSON.parse(dimensions) : {},
      deliveryDays: deliveryDays || 3,
      isFeatured: isFeatured === 'true',
    });

    await Category.findByIdAndUpdate(category, { $inc: { productCount: 1 } });
    res.status(201).json({ success: true, message: 'Product created!', data: product });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// PUT /api/products/:id
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const fields = ['name', 'description', 'price', 'discountPrice', 'stock', 'material', 'deliveryDays', 'isFeatured', 'isActive'];
    fields.forEach((field) => { if (req.body[field] !== undefined) product[field] = req.body[field]; });

    if (req.body.category)    product.category   = req.body.category;
    if (req.body.color)       product.color      = Array.isArray(req.body.color) ? req.body.color : req.body.color.split(',');
    if (req.body.tags)        product.tags       = Array.isArray(req.body.tags)  ? req.body.tags  : req.body.tags.split(',');
    if (req.body.dimensions)  product.dimensions = JSON.parse(req.body.dimensions);

    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((f) => `/uploads/${f.filename}`);
      product.images  = [...product.images, ...newImages].slice(0, 5);
    }

    const updated = await product.save();
    res.json({ success: true, message: 'Product updated!', data: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// DELETE /api/products/:id
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    product.images.forEach((img) => {
      const imgPath = path.join(__dirname, '..', img);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    });
    await Category.findByIdAndUpdate(product.category, { $inc: { productCount: -1 } });
    res.json({ success: true, message: 'Product deleted!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/products/:id/image
const deleteProductImage = async (req, res) => {
  try {
    const { imagePath } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    product.images = product.images.filter((img) => img !== imagePath);
    await product.save();
    const fullPath = path.join(__dirname, '..', imagePath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    res.json({ success: true, message: 'Image removed', data: product.images });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/products/:id/reviews
const addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    const alreadyReviewed = product.reviews.find((r) => r.user.toString() === req.user._id.toString());
    if (alreadyReviewed) return res.status(400).json({ success: false, error: 'You have already reviewed this product' });
    product.reviews.push({ user: req.user._id, name: req.user.name, rating: Number(rating), comment });
    product.numReviews = product.reviews.length;
    product.rating     = product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length;
    await product.save();
    res.status(201).json({ success: true, message: 'Review added' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/products/seed/data
const seedProducts = async (req, res) => {
  try {
    // Get or create a default sofa category
    let sofaCategory = await Category.findOne({ name: 'Sofas' });
    if (!sofaCategory) {
      sofaCategory = await Category.create({ name: 'Sofas', description: 'Premium sofa collection' });
    }

    await Product.deleteMany({ category: sofaCategory._id });

    const sampleData = [
      {
        name: 'Royal Chesterfield Sofa',
        description: 'Classic tufted Chesterfield sofa with deep button detailing and rolled arms. Perfect for a luxurious living room.',
        price: 85000, discountPrice: 72000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400'],
        stock: 10, material: 'Genuine Leather', color: ['Brown', 'Black', 'Burgundy'],
        dimensions: { length: 220, width: 90, height: 85, unit: 'cm' },
        rating: 4.8, numReviews: 124, isFeatured: true, deliveryDays: 7,
        tags: ['chesterfield', 'leather', 'classic', 'luxury'],
      },
      {
        name: 'Modern L-Shape Corner Sofa',
        description: 'Spacious L-shaped sectional sofa ideal for large living rooms. Features removable cushions and sturdy wooden legs.',
        price: 65000, discountPrice: 55000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=400'],
        stock: 8, material: 'Fabric', color: ['Grey', 'Beige', 'Navy Blue'],
        dimensions: { length: 280, width: 180, height: 80, unit: 'cm' },
        rating: 4.7, numReviews: 98, isFeatured: true, deliveryDays: 5,
        tags: ['l-shape', 'sectional', 'modern', 'large'],
      },
      {
        name: 'Scandinavian 3-Seater Sofa',
        description: 'Minimalist Scandinavian design with solid oak legs and high-density foam cushions for ultimate comfort.',
        price: 42000, discountPrice: 35000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=400'],
        stock: 15, material: 'Linen', color: ['Light Grey', 'Cream', 'Mustard'],
        dimensions: { length: 210, width: 85, height: 78, unit: 'cm' },
        rating: 4.6, numReviews: 87, isFeatured: false, deliveryDays: 4,
        tags: ['scandinavian', 'minimalist', '3-seater', 'oak'],
      },
      {
        name: 'Velvet Luxury 2-Seater Sofa',
        description: 'Opulent velvet upholstered loveseat with gold-finish metal legs. A statement piece for any room.',
        price: 38000, discountPrice: 32000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=400'],
        stock: 12, material: 'Velvet', color: ['Emerald Green', 'Royal Blue', 'Blush Pink'],
        dimensions: { length: 160, width: 80, height: 82, unit: 'cm' },
        rating: 4.9, numReviews: 156, isFeatured: true, deliveryDays: 5,
        tags: ['velvet', '2-seater', 'luxury', 'gold-legs'],
      },
      {
        name: 'Recliner Sofa with Cup Holders',
        description: 'Power reclining sofa with built-in cup holders, USB charging ports and storage armrests.',
        price: 72000, discountPrice: 60000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1567538096621-38d2284b23ff?w=400'],
        stock: 6, material: 'Faux Leather', color: ['Black', 'Dark Brown', 'Grey'],
        dimensions: { length: 240, width: 95, height: 105, unit: 'cm' },
        rating: 4.7, numReviews: 203, isFeatured: true, deliveryDays: 7,
        tags: ['recliner', 'power', 'usb', 'storage'],
      },
      {
        name: 'Bohemian Rattan Sofa',
        description: 'Natural rattan frame sofa with thick cushions, perfect for a boho-chic living space or sunroom.',
        price: 28000, discountPrice: 23000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400'],
        stock: 20, material: 'Rattan & Cotton', color: ['Natural', 'White', 'Terracotta'],
        dimensions: { length: 185, width: 78, height: 76, unit: 'cm' },
        rating: 4.5, numReviews: 64, isFeatured: false, deliveryDays: 3,
        tags: ['rattan', 'bohemian', 'natural', 'sunroom'],
      },
      {
        name: 'Mid-Century Modern Sofa',
        description: 'Timeless mid-century design with tapered wooden legs and button-tufted back. A retro classic for modern homes.',
        price: 48000, discountPrice: 40000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=400'],
        stock: 9, material: 'Boucle Fabric', color: ['Walnut Brown', 'Olive Green', 'Camel'],
        dimensions: { length: 200, width: 82, height: 80, unit: 'cm' },
        rating: 4.8, numReviews: 111, isFeatured: false, deliveryDays: 5,
        tags: ['mid-century', 'retro', 'tufted', 'tapered-legs'],
      },
      {
        name: 'Sleeper Sofa Bed',
        description: 'Versatile sofa that converts into a comfortable queen-size bed in seconds. Perfect for guest rooms.',
        price: 55000, discountPrice: 46000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400'],
        stock: 7, material: 'Microfiber', color: ['Charcoal', 'Beige', 'Navy'],
        dimensions: { length: 215, width: 90, height: 82, unit: 'cm' },
        rating: 4.6, numReviews: 77, isFeatured: false, deliveryDays: 6,
        tags: ['sofa-bed', 'sleeper', 'convertible', 'guest'],
      },
      {
        name: 'Modular Sectional Sofa',
        description: 'Mix-and-match modular sofa system. Rearrange the pieces to fit any room layout.',
        price: 95000, discountPrice: 80000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=400'],
        stock: 5, material: 'Performance Fabric', color: ['Slate Grey', 'Off White', 'Terracotta'],
        dimensions: { length: 320, width: 200, height: 78, unit: 'cm' },
        rating: 4.9, numReviews: 89, isFeatured: true, deliveryDays: 10,
        tags: ['modular', 'sectional', 'flexible', 'large'],
      },
      {
        name: 'Compact Studio Sofa',
        description: 'Space-saving 2-seater sofa designed for studio apartments and small living spaces.',
        price: 18000, discountPrice: 15000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=400'],
        stock: 25, material: 'Polyester', color: ['Teal', 'Orange', 'Light Blue'],
        dimensions: { length: 140, width: 70, height: 75, unit: 'cm' },
        rating: 4.4, numReviews: 52, isFeatured: false, deliveryDays: 3,
        tags: ['compact', 'studio', 'small-space', '2-seater'],
      },
      {
        name: 'Tuxedo Style Sofa',
        description: 'Sharp tuxedo silhouette with equal-height arms and back. A sophisticated choice for formal living rooms.',
        price: 52000, discountPrice: 44000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=400'],
        stock: 11, material: 'Chenille', color: ['Ivory', 'Charcoal', 'Dusty Rose'],
        dimensions: { length: 205, width: 85, height: 83, unit: 'cm' },
        rating: 4.7, numReviews: 68, isFeatured: false, deliveryDays: 5,
        tags: ['tuxedo', 'formal', 'classic', 'chenille'],
      },
      {
        name: 'Cloud Sofa (Deep Seat)',
        description: 'Ultra-deep seating cloud sofa with oversized cushions. Sink in and never want to get up.',
        price: 78000, discountPrice: 66000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1567538096621-38d2284b23ff?w=400'],
        stock: 6, material: 'Sherpa Fabric', color: ['Cream', 'Sand', 'Warm White'],
        dimensions: { length: 260, width: 115, height: 72, unit: 'cm' },
        rating: 4.9, numReviews: 183, isFeatured: true, deliveryDays: 7,
        tags: ['cloud', 'deep-seat', 'oversized', 'cozy'],
      },
      {
        name: 'Industrial Loft Sofa',
        description: 'Raw leather and metal frame sofa with an industrial edge. Perfect for loft and urban interiors.',
        price: 62000, discountPrice: 52000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=400'],
        stock: 8, material: 'Genuine Leather', color: ['Tan', 'Dark Brown', 'Black'],
        dimensions: { length: 215, width: 88, height: 80, unit: 'cm' },
        rating: 4.6, numReviews: 74, isFeatured: false, deliveryDays: 6,
        tags: ['industrial', 'loft', 'metal-frame', 'leather'],
      },
      {
        name: 'Curved Bouclé Sofa',
        description: 'Elegant curved silhouette in trendy bouclé fabric. The centerpiece of contemporary interiors.',
        price: 68000, discountPrice: 57000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400'],
        stock: 7, material: 'Bouclé', color: ['Ivory', 'Camel', 'Sage Green'],
        dimensions: { length: 225, width: 92, height: 76, unit: 'cm' },
        rating: 4.8, numReviews: 92, isFeatured: true, deliveryDays: 7,
        tags: ['curved', 'boucle', 'contemporary', 'statement'],
      },
      {
        name: 'Camelback Sofa',
        description: 'Traditional camelback sofa with elegant hump-shaped back and rolled arms. A timeless furniture piece.',
        price: 45000, discountPrice: 38000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400'],
        stock: 10, material: 'Damask Fabric', color: ['Gold', 'Deep Red', 'Royal Blue'],
        dimensions: { length: 195, width: 83, height: 88, unit: 'cm' },
        rating: 4.5, numReviews: 45, isFeatured: false, deliveryDays: 5,
        tags: ['camelback', 'traditional', 'rolled-arms', 'classic'],
      },
      {
        name: 'Floating Sofa with LED Base',
        description: 'Ultra-modern sofa with an illuminated LED base that gives a floating effect. A showstopper for modern homes.',
        price: 88000, discountPrice: 74000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=400'],
        stock: 4, material: 'Premium Fabric', color: ['White', 'Black', 'Grey'],
        dimensions: { length: 230, width: 90, height: 70, unit: 'cm' },
        rating: 4.8, numReviews: 57, isFeatured: true, deliveryDays: 10,
        tags: ['led', 'floating', 'ultra-modern', 'statement'],
      },
      {
        name: 'Farmhouse Slipcovered Sofa',
        description: 'Relaxed farmhouse-style sofa with washable slipcover. Practical, cozy and stylish for family homes.',
        price: 32000, discountPrice: 27000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=400'],
        stock: 18, material: 'Cotton Canvas', color: ['White', 'Natural', 'Light Blue'],
        dimensions: { length: 205, width: 88, height: 80, unit: 'cm' },
        rating: 4.5, numReviews: 103, isFeatured: false, deliveryDays: 4,
        tags: ['farmhouse', 'slipcover', 'washable', 'family'],
      },
      {
        name: 'Loveseat Ottoman Combo',
        description: 'Matching loveseat and ottoman set. The ottoman doubles as extra seating or a footrest.',
        price: 35000, discountPrice: 29000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=400'],
        stock: 14, material: 'Velvet', color: ['Dusty Pink', 'Forest Green', 'Navy'],
        dimensions: { length: 155, width: 78, height: 80, unit: 'cm' },
        rating: 4.6, numReviews: 81, isFeatured: false, deliveryDays: 4,
        tags: ['loveseat', 'ottoman', 'set', 'velvet'],
      },
      {
        name: 'High-Back Wing Sofa',
        description: 'Stately high-back wing sofa with ear-shaped sides for a cocoon-like seating experience.',
        price: 58000, discountPrice: 49000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1567538096621-38d2284b23ff?w=400'],
        stock: 9, material: 'Tweed', color: ['Herringbone Grey', 'Dark Green', 'Burgundy'],
        dimensions: { length: 200, width: 90, height: 95, unit: 'cm' },
        rating: 4.7, numReviews: 66, isFeatured: false, deliveryDays: 6,
        tags: ['high-back', 'wing', 'cocoon', 'formal'],
      },
      {
        name: 'Sofa with Built-in Bookshelf',
        description: 'Innovative sofa design with integrated bookshelf armrests. Functional and stylish for book lovers.',
        price: 48000, discountPrice: 40000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=400'],
        stock: 7, material: 'Fabric & Wood', color: ['Walnut + Grey', 'Oak + Beige'],
        dimensions: { length: 230, width: 88, height: 82, unit: 'cm' },
        rating: 4.6, numReviews: 49, isFeatured: false, deliveryDays: 7,
        tags: ['bookshelf', 'storage', 'functional', 'innovative'],
      },
      {
        name: 'Pet-Friendly Sofa',
        description: 'Scratch-resistant and stain-proof sofa fabric ideal for homes with pets. Easy to clean.',
        price: 38000, discountPrice: 32000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400'],
        stock: 20, material: 'Performance Fabric', color: ['Mocha', 'Sand', 'Slate'],
        dimensions: { length: 210, width: 85, height: 80, unit: 'cm' },
        rating: 4.8, numReviews: 137, isFeatured: true, deliveryDays: 4,
        tags: ['pet-friendly', 'stain-proof', 'scratch-resistant', 'easy-clean'],
      },
      {
        name: 'Outdoor Waterproof Sofa',
        description: 'All-weather outdoor sofa with UV-resistant and waterproof cushions. Perfect for patios and gardens.',
        price: 42000, discountPrice: 35000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400'],
        stock: 13, material: 'Olefin Fabric', color: ['Charcoal', 'Beige', 'Teal'],
        dimensions: { length: 200, width: 88, height: 76, unit: 'cm' },
        rating: 4.7, numReviews: 94, isFeatured: false, deliveryDays: 5,
        tags: ['outdoor', 'waterproof', 'UV-resistant', 'garden'],
      },
      {
        name: 'Japanese Floor Sofa',
        description: 'Low-profile Japanese-inspired floor sofa with firm zaisu-style cushions. Ideal for a zen living room.',
        price: 22000, discountPrice: 18500,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=400'],
        stock: 16, material: 'Cotton', color: ['Off White', 'Charcoal', 'Earthy Brown'],
        dimensions: { length: 190, width: 80, height: 35, unit: 'cm' },
        rating: 4.5, numReviews: 58, isFeatured: false, deliveryDays: 3,
        tags: ['japanese', 'floor', 'low-profile', 'zen'],
      },
      {
        name: 'Knole Sofa',
        description: 'Historic Knole design with adjustable side panels tied with ropes. A rare collector piece for traditional homes.',
        price: 92000, discountPrice: 78000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=400'],
        stock: 3, material: 'Jacquard Fabric', color: ['Antique Gold', 'Deep Red', 'Forest Green'],
        dimensions: { length: 210, width: 95, height: 100, unit: 'cm' },
        rating: 4.9, numReviews: 28, isFeatured: true, deliveryDays: 14,
        tags: ['knole', 'antique', 'adjustable', 'collector'],
      },
      {
        name: 'Egg Pod Sofa Chair',
        description: 'Futuristic egg-shaped pod sofa that cocoons you from the world. A design icon for modern spaces.',
        price: 55000, discountPrice: 46000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=400'],
        stock: 8, material: 'Wool Blend', color: ['Red', 'White', 'Black'],
        dimensions: { length: 110, width: 100, height: 120, unit: 'cm' },
        rating: 4.7, numReviews: 72, isFeatured: false, deliveryDays: 7,
        tags: ['egg', 'pod', 'futuristic', 'design-icon'],
      },
      {
        name: 'Lawson Style Sofa',
        description: 'Relaxed Lawson-style sofa with loose back cushions and low arms. The definition of casual comfort.',
        price: 36000, discountPrice: 30000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1567538096621-38d2284b23ff?w=400'],
        stock: 14, material: 'Microfiber Suede', color: ['Cappuccino', 'Charcoal', 'Taupe'],
        dimensions: { length: 215, width: 90, height: 78, unit: 'cm' },
        rating: 4.5, numReviews: 83, isFeatured: false, deliveryDays: 4,
        tags: ['lawson', 'casual', 'loose-cushion', 'comfortable'],
      },
      {
        name: 'Sofa with Chaise Lounge',
        description: '3-seater sofa with attached chaise lounge for extended relaxation. Right or left configuration available.',
        price: 68000, discountPrice: 57000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=400'],
        stock: 9, material: 'Fabric', color: ['Light Grey', 'Dark Grey', 'Olive'],
        dimensions: { length: 290, width: 160, height: 80, unit: 'cm' },
        rating: 4.8, numReviews: 115, isFeatured: true, deliveryDays: 6,
        tags: ['chaise', 'lounge', '3-seater', 'extended'],
      },
      {
        name: 'Cabriole Sofa',
        description: 'French-inspired cabriole sofa with curved cabriole legs and show wood frame. Elegance redefined.',
        price: 74000, discountPrice: 63000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400'],
        stock: 5, material: 'Silk Blend', color: ['Champagne', 'Soft Pink', 'Sky Blue'],
        dimensions: { length: 190, width: 82, height: 86, unit: 'cm' },
        rating: 4.8, numReviews: 39, isFeatured: false, deliveryDays: 10,
        tags: ['cabriole', 'french', 'curved-legs', 'elegant'],
      },
      {
        name: 'Conversation Pit Sofa Set',
        description: 'Sunken conversation pit sofa set — a retro 70s-inspired seating arrangement for open living spaces.',
        price: 120000, discountPrice: 102000,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400'],
        stock: 2, material: 'Velvet', color: ['Burnt Orange', 'Cream', 'Moody Brown'],
        dimensions: { length: 350, width: 350, height: 65, unit: 'cm' },
        rating: 4.9, numReviews: 21, isFeatured: true, deliveryDays: 14,
        tags: ['conversation-pit', 'sunken', 'retro', 'statement'],
      },
      {
        name: 'Inflatable Travel Sofa',
        description: 'Lightweight inflatable sofa for outdoor use, camping and travel. Inflates in seconds.',
        price: 4500, discountPrice: 3800,
        category: sofaCategory._id,
        images: ['https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=400'],
        stock: 50, material: 'Ripstop Nylon', color: ['Blue', 'Green', 'Orange', 'Pink'],
        dimensions: { length: 180, width: 70, height: 50, unit: 'cm' },
        rating: 4.3, numReviews: 210, isFeatured: false, deliveryDays: 2,
        tags: ['inflatable', 'travel', 'outdoor', 'camping'],
      },
    ];

    const products = await Product.insertMany(sampleData);
    await Category.findByIdAndUpdate(sofaCategory._id, { productCount: products.length });

    res.json({ success: true, message: `${products.length} sofas seeded!`, data: products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export {
  getAllProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  deleteProductImage,
  addReview,
  seedProducts,
};