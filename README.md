# Furniture Store — Backend

Node.js + Express REST API for the Furniture Management System. MongoDB Atlas database, JWT authentication, Razorpay payment integration, and order management.

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| Node.js | Runtime |
| Express.js | Web framework |
| MongoDB Atlas | Database |
| Mongoose | ODM |
| JWT | Authentication |
| Razorpay | Payment gateway |
| bcryptjs | Password hashing |
| express-async-handler | Async error handling |

---

##  Folder Structure

```
E:/Furniture Management System Backend/
├── controllers/
│   ├── orderController.js
│   ├── productController.js
│   ├── userController.js
│   └── cartController.js
├── middleware/
│   ├── authMiddleware.js
│   └── adminMiddleware.js
├── models/
│   ├── Order.js
│   ├── Product.js
│   ├── User.js
│   └── Cart.js
├── routes/
│   ├── orderRoutes.js
│   ├── productRoutes.js
│   ├── userRoutes.js
│   └── cartRoutes.js
├── .env
├── server.js
└── package.json
```

---

##  Setup & Installation

### 1. Install dependencies

```bash
cd "E:/Furniture Management System Backend"
npm install
```

### 2. Install Razorpay package

```bash
npm install razorpay
```

### 3. Configure `.env`

Create `.env` in the backend root:

```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/furniture-management
JWT_SECRET=your_jwt_secret_key_here
RAZORPAY_KEY_ID=rzp_test_T0FNBRLOck5CC6
RAZORPAY_KEY_SECRET=your_razorpay_secret_here
```

> Get Razorpay keys from: [https://dashboard.razorpay.com/app/keys](https://dashboard.razorpay.com/app/keys)

### 4. Start server

```bash
node server.js
```

Server runs at **http://localhost:5000**

---

##  Models

### Order.js

```
orderNumber   String (unique, sparse)
user          ObjectId → User
items         [{ product, name, quantity, price, image }]
shippingAddress { street, city, state, pincode, phone }
paymentMethod razorpay | cod
paymentStatus pending | paid | failed
paymentId     String
itemsPrice    Number
shippingPrice Number
taxPrice      Number
totalPrice    Number
orderStatus   pending | confirmed | processing | shipped | delivered | cancelled
isPaid        Boolean
isDelivered   Boolean
cancelReason  String
```

---

##  API Routes

### Auth — `/api/users`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/users/register` | Public | Register user |
| POST | `/api/users/login` | Public | Login, returns JWT |
| GET | `/api/users/profile` | Protected | Get own profile |

### Products — `/api/products`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/products` | Public | Get all products |
| GET | `/api/products/:id` | Public | Get single product |
| POST | `/api/products` | Admin | Create product |
| PUT | `/api/products/:id` | Admin | Update product |
| DELETE | `/api/products/:id` | Admin | Delete product |

### Cart — `/api/cart`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/cart` | Protected | Get user cart |
| POST | `/api/cart` | Protected | Add item to cart |
| PUT | `/api/cart` | Protected | Update quantity |
| DELETE | `/api/cart/:productId` | Protected | Remove item |

### Orders — `/api/orders`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/orders` | Protected | Create order (COD) |
| POST | `/api/orders/razorpay/create` | Protected | Create Razorpay order (Pay Now) |
| POST | `/api/orders/razorpay/verify` | Protected | Verify Razorpay payment |
| POST | `/api/orders/pay-later` | Protected | Save order, pay later |
| GET | `/api/orders/my` | Protected | Get my orders |
| GET | `/api/orders` | Admin | Get all orders |
| GET | `/api/orders/:id` | Protected | Get order by ID |
| PATCH | `/api/orders/:id/status` | Admin | Update order status |
| PATCH | `/api/orders/:id/cancel` | Protected | Cancel order |
| POST | `/api/orders/:id/razorpay/create` | Protected | Pay Now for pending order |
| GET | `/api/orders/:id/invoice` | Protected | Download invoice |

---

##  Razorpay Payment Flow

```
Frontend: POST /orders/razorpay/create
  → Backend creates Razorpay order + DB order (paymentStatus: pending)
  → Returns { razorpayOrderId, amount, currency, orderId }

Frontend: Razorpay popup opens → User pays

Frontend: POST /orders/razorpay/verify
  → Backend verifies HMAC signature
  → Updates order: paymentStatus: paid, orderStatus: confirmed
```

### Pay Later Flow

```
Frontend: POST /orders/pay-later
  → Backend saves order (paymentStatus: pending)
  → Stock deducted, cart cleared

My Orders page: POST /orders/:id/razorpay/create
  → Backend creates Razorpay order for existing DB order
  → Same verify flow above
```

---

##  Authentication

JWT token sent in `Authorization: Bearer <token>` header.

`authMiddleware.js` — verifies token, attaches `req.user`
`adminMiddleware.js` — checks `req.user.role === "admin"`

---

##  Order Status Flow

```
pending → confirmed → processing → shipped → delivered
                                              
Any status (pending/confirmed only) → cancelled
```

When cancelled: stock is automatically restored.

---

##  MongoDB Atlas Setup

1. Go to [https://cloud.mongodb.com](https://cloud.mongodb.com)
2. Create cluster → Database → `furniture-management`
3. Collections: `users`, `products`, `carts`, `orders`
4. Network Access → Add IP `0.0.0.0/0` (allow all)
5. Copy connection string → paste in `.env` as `MONGO_URI`

---

##  Production Checklist

- [ ] Change `RAZORPAY_KEY_ID` to live key (`rzp_live_...`)
- [ ] Set strong `JWT_SECRET`
- [ ] Restrict MongoDB Network Access to server IP
- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Deploy to Railway, Render, or EC2