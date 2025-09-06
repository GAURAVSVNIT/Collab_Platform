// src/app.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import http from "http";
import { Server as IOServer } from "socket.io";

// Import models (fixed)
import db from "./models/index.js"; // adjust path if needed
const { meet: Meet, session: Session } = db;

// Import routes
import userRouter from "./routes/user.routes.js";
import healthcheckRouter from "./routes/healthcheck.routes.js";
import meetRouter from "./routes/meet.js";
import sessionRouter from "./routes/session.js";

const app = express();

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}))
app.use(express.static("public"))
app.use(cookieParser())


//routes import
import userRouter from './routes/user.routes.js'
import healthcheckRouter from "./routes/healthcheck.routes.js"
import workspaceRouter from './routes/workspace.routes.js'

//routes declaration
app.use("/api/v1/healthcheck", healthcheckRouter)
app.use("/api/v1/users", userRouter)
app.use("/api/v1/workspaces", workspaceRouter)

// http://localhost:8000/api/v1/users/register

export { app }