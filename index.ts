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
import { Post } from "./models/postSchema";

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
      }),
    );

    app.use(cookieParser());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // ✅ FIXED: Hardcoded to "/api/v1" (No more Base URL variable issues)
    app.use("/api/v1", routers);

    // Add this new route for Bots
    app.get("/share/:id", async (req, res) => {
      try {
        const postId = req.params.id;
        const post = await Post.findById(postId);

        if (!post) return res.status(404).send("Not found");

        // We construct a simple HTML page JUST for the image preview
        const html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>${post.title}</title>
                
                <meta property="og:title" content="${post.title}" />
                <meta property="og:description" content="${post.content.replace(/<[^>]*>/g, "").substring(0, 150)}..." />
                <meta property="og:image" content="${post.image.url}" />
                <meta property="og:url" content="https://protidinjonotarnews.com/single-post/${postId}" />
                <meta property="og:type" content="article" />
                
                <meta http-equiv="refresh" content="0;url=https://protidinjonotarnews.com/single-post/${postId}" />
            </head>
            <body>
                <img src="${post.image.url}" style="max-width:100%;" />
                <h1>${post.title}</h1>
            </body>
            </html>
        `;

        res.send(html);
      } catch (error) {
        console.error(error);
        res.status(500).send("Error");
      }
    });

    app.use(errorHandler);

    // --- START SERVER ---
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);

      // Connect to DB in background
      dbConnect();
    });
  } catch (error) {
    console.error("❌ Critical Startup Error:", error);
  }
})();
