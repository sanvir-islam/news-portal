import { Request, Response, NextFunction } from "express";
import requestIp from "request-ip";
import mongoose from "mongoose";
import { Post } from "../models/postSchema";
import { PostView } from "../models/postViewSchema";

// 🛡️ THE IN-MEMORY BOT SHIELD
// This remembers who viewed what without asking MongoDB.
// Key format: "IP_POSTID", Value: Timestamp
const viewCache = new Map<string, number>();

// Clean the cache every 6 hours so it doesn't eat your server's RAM
setInterval(() => {
  viewCache.clear();
}, 6 * 60 * 60 * 1000);

export const trackPostView = (req: Request, res: Response, next: NextFunction) => {
  const postId = req.params.id || req.params.postId;

  if (!postId || !mongoose.isValidObjectId(postId)) {
    return next();
  }

  const userAgent = req.headers["user-agent"] || "unknown";
  let clientIp = requestIp.getClientIp(req) || "unknown";

  if (clientIp === "::1") clientIp = "127.0.0.1";
  if (clientIp.startsWith("::ffff:")) clientIp = clientIp.replace("::ffff:", "");

  // ==========================================
  // 1. CHECK RAM CACHE FIRST (0 DB Queries!)
  // ==========================================
  const cacheKey = `${clientIp}_${postId}`;
  const lastViewed = viewCache.get(cacheKey);
  const now = Date.now();

  // If this IP viewed this exact post in the last 24 hours, IGNORE COMPLETELY.
  if (lastViewed && (now - lastViewed < 24 * 60 * 60 * 1000)) {
    return next(); // Bot gets stopped here. MongoDB is completely safe!
  }

  // Record the view in our RAM cache instantly
  viewCache.set(cacheKey, now);

  // Send the user to the article instantly
  next();

  // ==========================================
  // 2. BACKGROUND DB WRITE
  // ==========================================
  (async () => {
    try {
      // Because our RAM cache handled the uniqueness check, 
      // we completely removed the expensive 'PostView.findOne' query!
      await Promise.all([
        PostView.create({
          post: postId,
          ip: clientIp,
          userAgent: userAgent,
        }),
        Post.findByIdAndUpdate(postId, { $inc: { views: 1 } }),
      ]);
    } catch (error) {
      console.error("Background View Tracking Error:", error);
    }
  })();
};