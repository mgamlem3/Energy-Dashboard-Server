const mongoose = require("mongoose");

const Schema = mongoose.Schema;

// this will be our data base's data structure 
const PowerSchema = new Schema(
    {
        date: Date,
        cost: String,
    },
    { timestamps: true }
);

// export the new Schema so we could modify it using Node.js
module.exports = mongoose.model("PowerCost", PowerSchema);
