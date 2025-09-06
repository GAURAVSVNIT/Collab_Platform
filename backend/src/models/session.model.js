import mongoose from "mongoose";

export default (mongooseInstance) => {
  const Session = mongooseInstance.model(
    "Session",
    new mongoose.Schema(
      {
        message: String,
        attachment: String,
        sessionid: String,  // user session id
        meetingid: String   // meeting id
      },
      { timestamps: true }
    )
  );

  return Session;
};
