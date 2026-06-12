export const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;
  if (err.name === "CastError" && err.kind === "ObjectId") { message = "Resource not found (invalid ID)"; statusCode = 404; }
  if (err.code === 11000) { const field = Object.keys(err.keyValue)[0]; message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`; statusCode = 400; }
  if (err.name === "ValidationError") { message = Object.values(err.errors).map((e) => e.message).join(", "); statusCode = 400; }
  res.status(statusCode).json({ success: false, message, stack: process.env.NODE_ENV === "development" ? err.stack : undefined });
};