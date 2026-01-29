// 1. Load dotenv FIRST
import dotenv from "dotenv";
dotenv.config();

// 2. Validate Env
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { validateEnv } = require("./utils/validateEnv");
  validateEnv();
} catch (err: any) {
  console.warn("⚠️ Env validation warning:", err.message);
}

// 3. Imports
import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import routers from "./routes/index";
import { dbConnect } from "./configs/db.config";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
const PORT = process.env.PORT || 5000;

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
      })
    );

    app.use(cookieParser());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // ✅ FIXED: Hardcoded to "/api/v1" (No more Base URL variable issues)
    app.use("/api/v1", routers);

    // ✅ DEBUG ROUTE
    app.get("/api/v1/hello", (_req: Request, res: Response) => {
      res.status(200).send("yes its live");
    });

    app.use(errorHandler);

    // --- START SERVER ---
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`👉 Test Link: http://localhost:${PORT}/api/v1/hello`);

      // Connect to DB in background
      dbConnect();
    });
  } catch (error) {
    console.error("❌ Critical Startup Error:", error);
  }
})();
