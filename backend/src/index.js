// src/index.js - Entry point
import dotenv from "dotenv";

// Configure dotenv
dotenv.config({ path: "./.env" });

// Import and start the app (which includes server setup)
import "./app.js";
