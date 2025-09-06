import db from "../models/index.js";   // adjust path if needed
const { meet: Meet } = db;

// create a meet
export const createonemeet = (req, res) => {
  const meet = new Meet({
    name: req.body.name ? req.body.name : "User",
    meetingid: req.body.meetingid,
    sessionid: req.body.sessionid,
  });

  meet
    .save(meet)
    .then((data) => {
      res.send(data);
    })
    .catch((err) => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while creating the meeting.",
      });
    });
};

// retrieve all meets for that meetingid
export const findallmeet = (req, res) => {
  const id = req.params.id;
  const condition = { meetingid: id };

  Meet.find(condition)
    .then((data) => {
      res.send(data);
    })
    .catch((err) => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving meets.",
      });
    });
};

// retrieve one meet for that sessionid
export const findonemeet = (req, res) => {
  const id = req.params.id;
  const condition = { sessionid: id };

  Meet.findOne(condition)
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

// delete a meet by sessionid
export const deleteonemeet = (req, res) => {
  const id = req.params.id;
  const condition = { sessionid: id };

  Meet.deleteOne(condition)
    .then((data) => {
      if (!data) {
        res.status(404).send({
          message: `Cannot delete meet with id=${id}!`,
        });
      } else {
        res.send({
          message: "Meet was deleted successfully!",
        });
      }
    })
    .catch((err) => {
      res.status(500).send({
        message: "Could not delete meet with id=" + id,
      });
    });
};
