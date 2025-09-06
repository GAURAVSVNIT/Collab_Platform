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
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(cookieParser());

// Routers with /api/v1 prefix
app.use("/api/v1/users", userRouter);
app.use("/api/v1/health", healthcheckRouter);
app.use("/api/v1/meet", meetRouter);
app.use("/api/v1/session", sessionRouter);

// HTTP + Socket.IO server
const httpServer = http.createServer(app);
const io = new IOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
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

  // WebRTC offer - Handle object data directly
  socket.on("offer_message", (data) => {
    try {
      const { to } = data; // Frontend sends { to, from, sdp }
      if (!to) return;
      io.to(to).emit("offer_message", data);
    } catch (err) {
      console.error("Error in offer_message:", err);
    }
  });

  // WebRTC answer - Handle object data directly  
  socket.on("answer_message", (data) => {
    try {
      const { to } = data; // Frontend sends { to, from, sdp }
      if (!to) return;
      io.to(to).emit("answer_message", data);
    } catch (err) {
      console.error("Error in answer_message:", err);
    }
  });

  // ICE candidate exchange
  socket.on("ice_candidate", (data) => {
    try {
      const { to } = data; // Frontend sends { to, from, candidate }
      if (!to) return;
      io.to(to).emit("ice_candidate", data);
    } catch (err) {
      console.error("Error in ice_candidate:", err);
    }
  });

  // Chat message - Handle both string and object data
  socket.on("sendmessage", (data) => {
    try {
      // Frontend sends message object directly
      socket.broadcast.emit("sendmessage", data);
    } catch (err) {
      console.error("Error in sendmessage:", err);
    }
  });

  // Legacy chat message support
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
