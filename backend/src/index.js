// src/server.js
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import { app, io } from "./app.js"; // ESM import of updated app with Socket.IO
import db from "./models/index.js"; // contains mongoose and models

const PORT = process.env.PORT || 3000;

// Connect to MongoDB
db.mongoose
  .connect(process.env.MONGODB_URI) // or db.url if you prefer
  .then(() => {
    console.log("✅ Connected to the database!");
  })
  .catch((err) => {
    console.error("❌ Cannot connect to the database!", err);
    process.exit(1);
  });
