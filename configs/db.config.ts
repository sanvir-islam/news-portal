import mongoose from "mongoose";

export const dbConnect = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error("FATAL ERROR: MONGODB_URI is not defined in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri, {
      maxPoolSize: 10, 
      minPoolSize: 2, 
      socketTimeoutMS: 45000, 
      
      // 👇 THE FIX FOR EAI_AGAIN & TIMEOUTS 👇
      serverSelectionTimeoutMS: 5000, // Don't hang forever if the network drops
      family: 4, // Force IPv4. This is the magic fix for Node.js DNS EAI_AGAIN errors!
    });

    console.log("✅ Database connected successfully");
  } catch (error) {
    console.error("❌ Database connection failed on startup:", error);
    process.exit(1);
  }
};

// 👇 AUTO-RECONNECT SAFETY NETS 👇
// These listen quietly in the background. If your VPS loses internet for 5 seconds, 
// Mongoose won't crash the app; it will just wait and reconnect automatically.
mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB connection lost! Waiting for network to return...");
});

mongoose.connection.on("reconnected", () => {
  console.log("✅ MongoDB network connection restored!");
});

mongoose.connection.on("error", (err) => {
  console.error("🔥 MongoDB background error:", err);
});