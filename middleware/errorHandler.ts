import { Request, Response, NextFunction } from "express";
import { MulterError } from "multer";

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Something went wrong.";

  // 🌟 FIX: Always log 500 errors so you aren't flying blind in production!
  if (statusCode === 500) {
    console.error("🔥 [Server Error]: ", err);
  }

  // =========================================================
  // 1. MONGOOSE / DATABASE ERRORS
  // =========================================================

  if (err.name === "CastError") {
    statusCode = 404;
    message = `Resource not found. Invalid ID: ${err.value}`;
  }

  if (err.code === 11000) {
    // Safely extract the duplicate field name
    const field = Object.keys(err.keyPattern || {})[0];
    const value = err.keyValue?.[field];
    statusCode = 409;
    message = `${field?.charAt(0).toUpperCase() + field?.slice(1)} '${value}' already exists`;
  }

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors || {})
      .map((val: any) => val.message)
      .join(", ");
  }

  if (err.name === "MongoNetworkError" || err.name === "MongooseServerSelectionError") {
    statusCode = 503;
    message = "Database connection failed. Please try again later.";
  }

  // =========================================================
  // 2. AUTHENTICATION ERRORS (JWT)
  // =========================================================

  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token. Please log in again.";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Your token has expired. Please log in again.";
  }

  // =========================================================
  // 3. FILE UPLOAD ERRORS (MULTER)
  // =========================================================

  if (err instanceof MulterError) {
    statusCode = 400;
    if (err.code === "LIMIT_FILE_SIZE") {
      message = "File size too large. Maximum size is 5MB.";
    } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
      // 🌟 FIX: Correct error meaning
      message = "Unexpected field name or too many files uploaded.";
    } else {
      message = err.message;
    }
  }

  // =========================================================
  // 4. RATE LIMITING
  // =========================================================

  if (statusCode === 429) {
    message = "Too many requests. Please try again later.";
  }

  // =========================================================
  // FINAL RESPONSE
  // =========================================================
  res.status(statusCode).json({
    success: false,
    message: message,
    // Only leak stack traces in dev mode
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
      error: err,
    }),
  });
};
