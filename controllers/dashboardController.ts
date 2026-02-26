import { Request, Response } from "express";
import { Post } from "../models/postSchema";
import { PostView } from "../models/postViewSchema";
import Category from "../models/categorySchema";
import { asyncHandler } from "../utils/asyncHandler";

/**
 * Fetches high-level statistics for the admin dashboard
 * Logic: Calculates total posts, categories, all-time views, and 24h traffic growth.
 */
export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  // Define time ranges for traffic analysis
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  // Parallel execution for maximum performance
  const [totalPosts, totalCategories, totalViews, viewsLast24h, viewsPrev24h] = await Promise.all([
    // A. Basic Totals
    Post.countDocuments(),
    Category.countDocuments(),

    // B. Persistence Check: Aggregate all-time view counts from individual posts
    Post.aggregate([{ $group: { _id: null, total: { $sum: "$views" } } }]).then((result) => result[0]?.total || 0),

    // C. Traffic Comparison (Current 24h vs Previous 24h)
    PostView.countDocuments({ createdAt: { $gte: oneDayAgo } }),
    PostView.countDocuments({ createdAt: { $gte: twoDaysAgo, $lt: oneDayAgo } }),
  ]);

  // Calculate percentage growth/decline
  let growthPercent = 0;
  if (viewsPrev24h === 0) {
    growthPercent = viewsLast24h > 0 ? 100 : 0;
  } else {
    growthPercent = ((viewsLast24h - viewsPrev24h) / viewsPrev24h) * 100;
  }

  // Round to 1 decimal place
  growthPercent = Math.round(growthPercent * 10) / 10;

  res.status(200).json({
    success: true,
    data: {
      totalPosts,
      totalCategories,
      totalViews,
      traffic24h: {
        count: viewsLast24h,
        previousCount: viewsPrev24h,
        growthPercent: growthPercent,
        isPositive: growthPercent >= 0, 
      },
    },
  });
});
