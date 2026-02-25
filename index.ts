// 🛡️ 1. GLOBAL CRASH NETS
process.on("uncaughtException", (err) => {
  console.error("🔥 UNCAUGHT EXCEPTION! Shutting down...");
  console.error(err.name, err.message, err.stack);
  process.exit(1); // PM2 will safely restart a fresh, healthy instance!
});

process.on("unhandledRejection", (err: any) => {
  console.error("🔥 UNHANDLED REJECTION! Shutting down...");
  console.error(err.name, err.message, err.stack);
  process.exit(1); // PM2 will safely restart a fresh, healthy instance!
});

// 2. Load dotenv FIRST
import dotenv from "dotenv";
dotenv.config();

// 3. Validate Env
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { validateEnv } = require("./utils/validateEnv");
  validateEnv();
} catch (err: any) {
  console.warn("⚠️ Env validation warning:", err.message);
}

// 4. Imports
import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import routers from "./routes/index";
import { dbConnect } from "./configs/db.config";
import { errorHandler } from "./middleware/errorHandler";
import botRoutes from "./routes/bot";

const app = express();
const PORT = process.env.PORT || 4500;

(async () => {
  try {
    app.set("trust proxy", 1);

    // --- CORS ---
    app.use(
      cors({
        origin: [
          "https://protidinjonotarnews.com",
          "https://www.protidinjonotarnews.com",
          "http://localhost:5173",
          "https://app.requestly.io",
        ],
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      }),
    );

    app.use(cookieParser());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // ✅ FIXED: Hardcoded to "/api/v1" (No more Base URL variable issues)
    app.use("/api/v1", routers);

    // Root/SEO Routes
    app.use("/", botRoutes);

    app.use(errorHandler);

    // Connect to DB
    await dbConnect();

    // --- START SERVER ---
    const server = app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });

    // Optional: Graceful shutdown on server termination signals (e.g., when PM2 stops/restarts the app)
    process.on("SIGTERM", () => {
      console.log("👋 SIGTERM received. Shutting down gracefully...");
      server.close(() => {
        console.log("💥 Process terminated.");
      });
    });

  } catch (error) {
    console.error("❌ Critical Startup Error:", error);
    process.exit(1);
  }
})();