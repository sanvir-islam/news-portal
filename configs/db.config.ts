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
      serverSelectionTimeoutMS: 15000, 
      family: 4, // Force IPv4 to prevent DNS EAI_AGAIN errors
    });

    console.log("✅ Database connected successfully");
  } catch (error) {
    console.error("❌ Database connection failed on startup:", error);
    process.exit(1);
  }
};

// 👇 AUTO-RECONNECT SAFETY NETS 👇
mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB connection lost! Waiting for network to return...");
});

mongoose.connection.on("reconnected", () => {
  console.log("✅ MongoDB network connection restored!");
});

mongoose.connection.on("error", (err) => {
  console.error("🔥 MongoDB background error:", err.message);
});