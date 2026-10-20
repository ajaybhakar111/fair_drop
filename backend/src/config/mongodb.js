import mongoose from "mongoose";

import { env } from "./env.js";

export async function connectMongoDB() {
  try {
    await mongoose.connect(env.MONGODB_URI);

    console.log("✅ MongoDB connected");
  } catch (error) {
    console.error("❌ MongoDB connection failed");
    console.error(error);

    process.exit(1);
  }
}

export function getMongoDBStatus() {
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting"
  };

  return states[mongoose.connection.readyState] || "unknown";
}