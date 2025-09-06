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
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(cookieParser());

// Routers
app.use("/users", userRouter);
app.use("/health", healthcheckRouter);
app.use("/meet", meetRouter);
app.use("/session", sessionRouter);

// HTTP + Socket.IO server
const httpServer = http.createServer(app);
const io = new IOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Socket.IO events
io.on("connection", (socket) => {
  console.log("New socket connected:", socket.id);

  // Join meeting
  socket.on("joined", async (data) => {
    try {
      const { meetingid, username } = JSON.parse(data);
      if (!meetingid) return;

      // Join the room
      socket.join(meetingid);

      // Notify others in the room
      socket.to(meetingid).emit("joined", socket.id);

      // Optional: save meet to DB
      // await Meet.create({ name: username || "User", meetingid, sessionid: socket.id });
    } catch (err) {
      console.error("Error in joined:", err);
    }
  });

  // WebRTC offer
  socket.on("offer_message", (data) => {
    try {
      const { offerto } = JSON.parse(data);
      if (!offerto) return;
      io.to(offerto).emit("offer_message", data);
    } catch (err) {
      console.error("Error in offer_message:", err);
    }
  });

  // WebRTC answer
  socket.on("answer_message", (data) => {
    try {
      const { offerto } = JSON.parse(data);
      if (!offerto) return;
      io.to(offerto).emit("answer_message", data);
    } catch (err) {
      console.error("Error in answer_message:", err);
    }
  });

  // Chat message
  socket.on("send", (data) => {
    try {
      const { meetingid, sessionid } = JSON.parse(data);
      if (!meetingid) return;
      socket.join(meetingid);
      socket.to(meetingid).emit("sendmessage", sessionid);
    } catch (err) {
      console.error("Error in send:", err);
    }
  });

  // Disconnect
  socket.on("disconnecting", () => {
    socket.rooms.forEach((room) => {
      socket.to(room).emit("exitmeeting", "someone has exited");
    });
  });
});

// Listening port
const PORT = process.env.PORT || 8000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { app, io };
