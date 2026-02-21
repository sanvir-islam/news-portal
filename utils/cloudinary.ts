import fs from "fs";
import cloudinary from "../configs/cloudinary.config";
import { createError } from "./createError";

// Helper: Upload image to Cloudinary & Delete local file
export const uploadToCloudinary = async (
  filePath: string,
  folder: string = "general",
): Promise<{ url: string; publicId: string }> => {
  try {
    // 1. Upload to Cloudinary (Timeout works perfectly here!)
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folder,
      timeout: 120000,
      transformation: [
        { width: 1200, height: 630, crop: "limit" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });

    // 2. Delete local file after successful upload
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fsError) {
      console.error("Warning: Failed to delete local file:", filePath);
    }

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error: any) {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        /* ignore */
      }
    }

    console.error("Cloudinary Upload Error:", error.message || error);
    throw createError("Image upload to cloud failed or took too long. Please try again.", 408);
  }
};

// Helper: Delete image from Cloudinary
export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    if (publicId) {
      // Removed the timeout here to fix the TypeScript error!
      await cloudinary.uploader.destroy(publicId);
    }
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error);
    // The try/catch protects the server if a random network glitch happens here!
  }
};
