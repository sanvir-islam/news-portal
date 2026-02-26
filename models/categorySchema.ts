import mongoose, { Schema, Document } from "mongoose";

/**
 * Interface representing a Category document
 */
export interface ICategory extends Document {
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Category Schema Definition
 * Logic: Handles unique categories and automatic slug generation for SEO-friendly URLs.
 */
const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      unique: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    slug: {
      type: String,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, "Description cannot exceed 200 characters"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

/**
 * Pre-save Hook: Generates Bengali-friendly SEO slugs
 * Handles both English and Bengali characters correctly.
 */
categorySchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = this.name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-") // Replace spaces with dashes
      .replace(/[^\w\u0980-\u09FF-]+/g, "") // Keep English, Bengali, and dashes
      .replace(/\-\-+/g, "-") // Remove double dashes
      .replace(/^-+/, "") // Trim leading dash
      .replace(/-+$/, ""); // Trim trailing dash
  }
  next();
});

const Category = mongoose.model<ICategory>("Category", categorySchema);
export default Category;
