// src/index.js - Entry point
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import db from "./models/index.js"; // contains mongoose and models

// Connect to MongoDB
db.mongoose
  .connect(db.url)
  .then(() => {
    console.log("✅ Connected to the database!");
    // Start the server after DB connection
    import("./app.js");
  })
  .catch((err) => {
    console.error("❌ Cannot connect to the database!", err);
    process.exit(1);
  });
