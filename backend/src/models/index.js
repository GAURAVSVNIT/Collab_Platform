import dbConfig from "../config/db.config.js";
import mongoose from "mongoose";
import meetModel from "./meet.model.js";
import sessionModel from "./session.model.js";
import integrationModel from "./integration.model.js";
import syncLogModel from "./syncLog.model.js";
import entityMappingModel from "./entityMapping.model.js";
// import userModel from "./user.model.js"; // if you need it

mongoose.Promise = global.Promise;

const db = {};
db.mongoose = mongoose;
db.url = dbConfig.url;

// databases
db.meet = meetModel(mongoose);
db.session = sessionModel(mongoose);
db.integration = integrationModel(mongoose);
db.syncLog = syncLogModel(mongoose);
db.entityMapping = entityMappingModel(mongoose);
// db.user = userModel(mongoose);

export default db;
