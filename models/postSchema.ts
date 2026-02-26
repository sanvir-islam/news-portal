import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * Interface representing a Post document in MongoDB
 */
export interface IPost extends Document {
  title: string;
  content: string;
  image: {
    url: string;
    publicId: string;
  };
  category: Types.ObjectId;
  views: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Post Schema Definition
 * Logic: Includes validation, performance indexing, and automated slug-like cleanup for Bengali/English content.
 */
const postSchema = new Schema<IPost>(
  {
    title: {
      type: String,
      required: [true, "Post title is required"],
      trim: true,
      minlength: [10, "Title must be at least 10 characters"],
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    content: {
      type: String,
      required: [true, "Post content is required"],
      minlength: [50, "Content must be at least 50 characters"],
    },
    image: {
      url: {
        type: String,
        required: [true, "Post image URL is required"],
      },
      publicId: {
        type: String,
        required: [true, "Post image public ID is required"],
      },
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },
    views: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
    toJSON: {
      transform: function (doc, ret: any) {
        delete ret.__v; // Remove version key from JSON responses
        return ret;
      },
    },
  }
);

// ==========================================
// PERFORMANCE INDEXES (Optimized for Atlas)
// ==========================================

// 1. Newest posts first (Homepage feed)
postSchema.index({ createdAt: -1 });

// 2. Category filtering with sorting (Category pages)
postSchema.index({ category: 1, createdAt: -1 });

// 3. Full-Text Search (Search bar)
postSchema.index({ title: "text", content: "text" });

export const Post = mongoose.model<IPost>("Post", postSchema);
