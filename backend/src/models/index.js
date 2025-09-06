import dbConfig from "../config/db.config.js";
import mongoose from "mongoose";
import meetModel from "./meet.model.js";
import sessionModel from "./session.model.js";
// import userModel from "./user.model.js"; // if you need it

mongoose.Promise = global.Promise;

const db = {};
db.mongoose = mongoose;
db.url = dbConfig.url;

// databases
db.meet = meetModel(mongoose);
db.session = sessionModel(mongoose);
// db.user = userModel(mongoose);

export default db;
