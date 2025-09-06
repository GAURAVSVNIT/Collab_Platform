import db from "../models/index.js"; // adjust path if needed
const { session: Session } = db;

// create a session
export const createonesession = (req, res) => {
  // check for message or attachments
  if (!req.body.message && !req.body.attachment) {
    return res.status(404).send({ message: "No message or attachment!" });
  }

  const session = new Session({
    message: req.body.message,
    attachment: req.body.attachment,
    meetingid: req.body.meetingid,
    sessionid: req.body.sessionid,
  });

  session
    .save(session)
    .then((data) => {
      res.send(data);
    })
    .catch((err) => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while creating the new message.",
      });
    });
};

// retrieve all sessions for a meeting
export const findallsession = (req, res) => {
  const id = req.params.id;
  const condition = { meetingid: id };

  Session.find(condition)
    .then((data) => {
      res.send(data);
    })
    .catch((err) => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving sessions.",
      });
    });
};

// retrieve one session by id
export const findonesession = (req, res) => {
  const id = req.params.id;

  Session.findById(id)
    .then((data) => {
      res.send(data);
    })
    .catch((err) => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving sessions.",
      });
    });
};

// delete a single session by id
export const deleteonesession = (req, res) => {
  const id = req.params.id;

  Session.findByIdAndRemove(id)
    .then((data) => {
      if (!data) {
        res.status(404).send({
          message: `Cannot delete contents with id=${id}!`,
        });
      } else {
        res.send({
          message: "Session was deleted successfully!",
        });
      }
    })
    .catch((err) => {
      res.status(500).send({
        message: "Could not delete session with id=" + id,
      });
    });
};

// delete all sessions for a specific meeting/session
export const deleteallsession = (req, res) => {
  const id = req.params.id;
  const condition = { sessionid: id };

  Session.deleteMany(condition)
    .then((data) => {
      res.send({
        message: `${data.deletedCount} Sessions were deleted successfully!`,
      });
    })
    .catch((err) => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while removing all sessions.",
      });
    });
};
