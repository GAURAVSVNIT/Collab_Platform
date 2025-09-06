import mongoose from "mongoose";

export default (mongooseInstance) => {
  const Meet = mongooseInstance.model(
    "Meet",
    new mongoose.Schema(
      {
        name: String,       // session name
        meetingid: String,  // meeting id
        sessionid: String,  // socket id
      },
      { timestamps: true }
    )
  );

  return Meet;
};
