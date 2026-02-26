import { Request, Response } from "express";
import { Types } from "mongoose";
import fs from "fs";
import { Post } from "../models/postSchema";
import { PostView } from "../models/postViewSchema";
import { BreakingNews } from "../models/breakingNewsSchema";
import { uploadToCloudinary, deleteFromCloudinary } from "../utils/cloudinary";
import { createError } from "../utils/createError";
import Category from "../models/categorySchema";
import { asyncHandler } from "../utils/asyncHandler";

/**
 * Custom Request interface to handle Multer files
 */
interface CustomRequest extends Request {
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
}

// ==========================================
// INTERNAL HELPERS
// ==========================================

/**
 * Manages the "Breaking News" list (keeps only the latest 5 posts)
 * @param postId - ID of the post to add
 */
const addToBreakingNewsList = async (postId: Types.ObjectId | string) => {
  let breaking = await BreakingNews.findOne();
  if (!breaking) {
    breaking = await BreakingNews.create({ posts: [] });
  }

  const currentList = breaking.posts.map((p) => p.toString());
  const newId = postId.toString();

  // Move existing post to front or add new one, then limit to 5
  const filteredList = currentList.filter((id) => id !== newId);
  filteredList.unshift(newId);
  breaking.posts = filteredList.slice(0, 5) as any;
  
  await breaking.save();
};

/**
 * Safely deletes a file from the local server without throwing errors if it's missing
 */
const safeDelete = (path: string) => {
  fs.unlink(path, (err) => {
    if (err && err.code !== "ENOENT") {
      console.error(`Failed to delete local file: ${path}`, err);
    }
  });
};

/**
 * Extracts the uploaded file from the request object (Multer)
 */
const getFile = (req: CustomRequest): Express.Multer.File | undefined => {
  if (Array.isArray(req.files) && req.files.length > 0) return req.files[0];
  if (req.files && typeof req.files === "object") {
    const values = Object.values(req.files);
    if (values.length > 0 && values[0].length > 0) return values[0][0];
  }
  return undefined;
};

/**
 * Escapes special characters for use in Regular Expressions
 */
const escapeRegex = (text: string) => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

// ==========================================
// CORE CONTROLLERS
// ==========================================

/**
 * 1. Create Post
 * Logic: Validates, uploads image to Cloudinary, saves to DB, and handles breaking news.
 */
export const createPost = asyncHandler(async (req: CustomRequest, res: Response) => {
  const { title, content, category, addToBreaking } = req.body;
  const file = getFile(req);

  // Validation
  if (!title || !content || !category) {
    if (file) safeDelete(file.path);
    throw createError("Required fields missing", 400);
  }

  if (title.length < 10) {
    if (file) safeDelete(file.path);
    throw createError("Title must be at least 10 characters", 400);
  }

  if (!file) throw createError("Image file is required", 400);

  const categoryExists = await Category.findById(category);
  if (!categoryExists) {
    if (file) safeDelete(file.path);
    throw createError("Invalid Category ID", 400);
  }

  // Cloudinary Upload
  let imageData;
  try {
    imageData = await uploadToCloudinary(file.path, "news-posts");
  } catch (error) {
    if (file) safeDelete(file.path);
    throw createError("Cloud image upload failed. Please try again.", 408);
  }

  try {
    const post = new Post({ title, content, image: imageData, category });
    await post.save();

    if (addToBreaking === "true" || addToBreaking === true) {
      await addToBreakingNewsList(post._id as Types.ObjectId);
    }

    res.status(201).json({ success: true, message: "Post published successfully", data: post });
  } catch (error) {
    // Cleanup: Remove image from Cloud if DB save fails
    if (imageData?.publicId) await deleteFromCloudinary(imageData.publicId);
    throw error;
  }
});

/**
 * 2. Update Post
 * Logic: Updates fields, handles image swap (deletes old image), and manages breaking news.
 */
export const updatePost = asyncHandler(async (req: CustomRequest, res: Response) => {
  const { postId } = req.params;
  const { title, content, category, addToBreaking } = req.body;
  const file = getFile(req);

  const oldPost = await Post.findById(postId);
  if (!oldPost) {
    if (file) safeDelete(file.path);
    throw createError("Post not found", 404);
  }

  const updateData: any = {}; 
  if (title) {
    if (title.length < 10) throw createError("Title must be 10+ chars", 400);
    updateData.title = title;
  }
  if (content) updateData.content = content;
  if (category) {
    if (!(await Category.findById(category))) throw createError("Invalid Category", 400);
    updateData.category = category;
  }

  let imageData = oldPost.image;
  let newImageUploaded = false;

  // Handle Image Update
  if (file) {
    try {
      imageData = await uploadToCloudinary(file.path, "news-posts");
      newImageUploaded = true;
      updateData.image = imageData;
    } catch (error) {
      if (file) safeDelete(file.path);
      throw createError("Image upload failed.", 408);
    }
  }

  try {
    const updatedPost = await Post.findByIdAndUpdate(postId, updateData, { new: true, runValidators: true })
      .populate("category", "name slug");

    if (addToBreaking === "true" || addToBreaking === true) {
      if (updatedPost) await addToBreakingNewsList(updatedPost._id as Types.ObjectId);
    }

    // Delete old image if swapped
    if (newImageUploaded && oldPost.image?.publicId) {
      await deleteFromCloudinary(oldPost.image.publicId);
    }

    res.status(200).json({ success: true, message: "Post updated", data: updatedPost });
  } catch (error) {
    if (newImageUploaded && imageData.publicId) await deleteFromCloudinary(imageData.publicId);
    throw error;
  }
});

/**
 * 3. Delete Post
 * Logic: Deletes post from DB and removes associated image from Cloudinary.
 */
export const deletePost = asyncHandler(async (req: Request, res: Response) => {
  const { postId } = req.params;
  const post = await Post.findById(postId);
  if (!post) throw createError("Post not found", 404);

  if (post.image?.publicId) await deleteFromCloudinary(post.image.publicId);
  await Post.findByIdAndDelete(postId);

  res.status(200).json({ success: true, message: "Post permanently deleted" });
});

/**
 * 4. Get Single Post
 */
export const getPostById = asyncHandler(async (req: Request, res: Response) => {
  const post = await Post.findById(req.params.postId).populate("category", "name slug");
  if (!post) throw createError("Post not found", 404);
  res.status(200).json({ success: true, data: post });
});

/**
 * 5. Get All Posts (Paginated)
 * Logic: Uses parallel queries for high-performance data fetching.
 */
export const getAllPosts = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const [posts, totalPosts] = await Promise.all([
    Post.find().sort({ createdAt: -1 }).skip(skip).limit(limit).populate("category", "name slug"),
    Post.countDocuments(),
  ]);

  const totalPages = Math.ceil(totalPosts / limit);

  res.status(200).json({
    success: true,
    data: posts,
    pagination: { currentPage: page, totalPages, totalPosts, hasNextPage: page < totalPages, limit },
  });
});

/**
 * 6. Search Posts
 * Logic: Implements MongoDB full-text search and category filtering.
 */
export const searchPosts = asyncHandler(async (req: Request, res: Response) => {
  const { query, categoryName } = req.query;
  const searchFilter: any = {};

  if (query) searchFilter.$text = { $search: query as string };
  if (categoryName) {
    const category = await Category.findOne({ name: { $regex: escapeRegex(categoryName as string), $options: "i" } });
    if (category) searchFilter.category = category._id;
    else return res.status(200).json({ success: true, data: [] });
  }

  let postsQuery = Post.find(searchFilter);
  if (query) {
    postsQuery = postsQuery.select({ score: { $meta: "textScore" } }).sort({ score: { $meta: "textScore" } });
  } else {
    postsQuery = postsQuery.sort({ createdAt: -1 });
  }

  const posts = await postsQuery.populate("category", "name slug");
  res.status(200).json({ success: true, data: posts });
});

/**
 * 7. Get Trending Posts
 * Logic: Aggregates views from last 24h/7d with a newest-post fallback to ensure 3 results.
 */
export const getTrendingPosts = asyncHandler(async (req: Request, res: Response) => {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let finalPosts: any[] = [];
  let collectedIds: Types.ObjectId[] = [];

  const fetchTrending = async (startTime: Date, excludeIds: Types.ObjectId[], limit: number) => {
    return PostView.aggregate([
      { $match: { createdAt: { $gte: startTime }, post: { $nin: excludeIds } } },
      { $group: { _id: "$post", viewCount: { $sum: 1 } } },
      { $sort: { viewCount: -1 } },
      { $limit: limit },
      { $lookup: { from: "posts", localField: "_id", foreignField: "_id", as: "postDetails" } },
      { $unwind: "$postDetails" },
      { $lookup: { from: "categories", localField: "postDetails.category", foreignField: "_id", as: "categoryDetails" } },
      { $unwind: { path: "$categoryDetails", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          viewCount: 1,
          "postDetails.title": 1,
          "postDetails.image": 1,
          "postDetails.createdAt": 1,
          "postDetails.slug": 1,
          category: { name: "$categoryDetails.name", slug: "$categoryDetails.slug" },
        },
      },
    ]);
  };

  // Step 1: Last 24h
  const trending24h = await fetchTrending(twentyFourHoursAgo, [], 3);
  finalPosts = [...trending24h];
  collectedIds = finalPosts.map((p) => p._id);

  // Step 2: Last 7d (if needed)
  if (finalPosts.length < 3) {
    const trending7d = await fetchTrending(sevenDaysAgo, collectedIds, 3 - finalPosts.length);
    finalPosts = [...finalPosts, ...trending7d];
    collectedIds = finalPosts.map((p) => p._id);
  }

  // Step 3: Fallback to Newest (if needed)
  if (finalPosts.length < 3) {
    const fallbacks = await Post.find({ _id: { $nin: collectedIds } })
      .sort({ createdAt: -1 })
      .limit(3 - finalPosts.length)
      .populate("category", "name slug");
    
    finalPosts = [
      ...finalPosts,
      ...fallbacks.map((p: any) => ({
        _id: p._id,
        viewCount: 0,
        postDetails: { title: p.title, image: p.image, createdAt: p.createdAt, slug: p.slug },
        category: { name: p.category?.name, slug: p.category?.slug },
      })),
    ];
  }

  res.status(200).json({ success: true, data: finalPosts });
});

/**
 * 8. Get Posts by Category (Paginated)
 */
export const getPostsByFilter = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  let filter: any = {};
  let filterName = "All Posts";

  if (id !== "all") {
    if (!Types.ObjectId.isValid(id)) throw createError("Invalid ID", 400);
    const category = await Category.findById(id);
    if (!category) throw createError("Category not found", 404);
    filter.category = category._id;
    filterName = category.name;
  }

  const [posts, totalPosts] = await Promise.all([
    Post.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("category", "name slug"),
    Post.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: posts,
    meta: { filterName, filterId: id },
    pagination: { currentPage: page, totalPages: Math.ceil(totalPosts / limit), totalPosts, limit },
  });
});

/**
 * 9. Get Breaking News
 */
export const getBreakingNews = asyncHandler(async (req: Request, res: Response) => {
  const breaking = await BreakingNews.findOne().populate("posts", "title slug image createdAt");
  res.status(200).json({ success: true, data: breaking?.posts || [] });
});

/**
 * 10. Remove Post from Breaking News
 */
export const removeFromBreakingNews = asyncHandler(async (req: Request, res: Response) => {
  const { postId } = req.params;
  const breaking = await BreakingNews.findOne();
  if (!breaking) return res.status(404).json({ success: false, message: "List not found" });

  breaking.posts = breaking.posts.filter((id) => id.toString() !== postId) as any;
  await breaking.save();

  res.status(200).json({ success: true, message: "Removed from Breaking News" });
});
