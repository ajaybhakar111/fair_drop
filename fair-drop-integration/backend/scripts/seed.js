// Creates the demo accounts the frontend login screens advertise.
// Run once:  npm run seed
import "dotenv/config";
import argon2 from "argon2";
import mongoose from "mongoose";

import { env } from "../src/config/env.js";
import User from "../src/models/User.js";

const ACCOUNTS = [
  { name: "Admin", email: "admin@example.com", password: "Admin123!", role: "ADMIN" },
  { name: "Abdullah", email: "user@example.com", password: "Password123!", role: "USER" }
];

async function seed() {
  await mongoose.connect(env.MONGODB_URI);

  for (const account of ACCOUNTS) {
    const existing = await User.findOne({ email: account.email });

    if (existing) {
      // Make sure the role is right, but never touch an existing password.
      if (existing.role !== account.role) {
        existing.role = account.role;
        await existing.save();
        console.log(`↻ ${account.email} role set to ${account.role}`);
      } else {
        console.log(`• ${account.email} already exists`);
      }
      continue;
    }

    await User.create({
      name: account.name,
      email: account.email,
      passwordHash: await argon2.hash(account.password, { type: argon2.argon2id }),
      role: account.role
    });

    console.log(`✓ created ${account.role} ${account.email}`);
  }

  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error("❌ Seed failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
