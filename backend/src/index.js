// require('dotenv').config({path: './env'})
import dotenv from "dotenv"
import connectDB from "./db/index.js";
import {app} from './app.js'
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupSocketIO } from './utils/socketHandler.js';

dotenv.config({
    path: './.env.local'
})

// Create HTTP server
const server = createServer(app);

// Setup Socket.IO
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Setup socket handlers
setupSocketIO(io);

connectDB()
.then(() => {
    server.listen(process.env.PORT || 8000, () => {
        console.log(`⚙️ Server is running at port : ${process.env.PORT}`);
        console.log(`🔌 Socket.IO server is ready for real-time connections`);
    })
})
.catch((err) => {
    console.log("MONGO db connection failed !!! ", err);
})










/*
import express from "express"
const app = express()
( async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("errror", (error) => {
            console.log("ERRR: ", error);
            throw error
        })

        app.listen(process.env.PORT, () => {
            console.log(`App is listening on port ${process.env.PORT}`);
        })

    } catch (error) {
        console.error("ERROR: ", error)
        throw err
    }
})()

*/
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
