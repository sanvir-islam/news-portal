import express from "express";
import { Post } from "../models/postSchema"; // Adjust path if necessary

const router = express.Router();

router.get("/share/:id", async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await Post.findById(postId);

    if (!post) return res.status(404).send("Not found");

    const title = post.title || "News Portal";
    const contentPreview = (post.content || "").replace(/<[^>]*>/g, "").substring(0, 150);
    const imageUrl = post.image?.url || "https://protidinjonotarnews.com/logo.png";

    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            
            <meta property="og:title" content="${title}" />
            <meta property="og:description" content="${contentPreview}..." />
            <meta property="og:image" content="${imageUrl}" />
            <meta property="og:url" content="https://protidinjonotarnews.com/single-post/${postId}" />
            <meta property="og:type" content="article" />
            
            <meta http-equiv="refresh" content="0;url=https://protidinjonotarnews.com/single-post/${postId}" />
        </head>
        <body>
            <img src="${imageUrl}" style="max-width:100%;" />
            <h1>${title}</h1>
            <p>${contentPreview}...</p>
        </body>
        </html>
    `;

    res.send(html);
  } catch (error) {
    console.error("Bot Route Error:", error);
    res.status(500).send("Error generating preview");
  }
});

export default router;
