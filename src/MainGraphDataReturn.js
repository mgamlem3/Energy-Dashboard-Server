const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const MainGraphDataReturn = new Schema({
    thisYearData : Array,
    lastYearData : Array,
    lastLastYearData : Array,
    lastMonthData : Array,
    last24HoursData : Array,
    hourLabels : Array,
    monthLabels : Array,
    yearLabels : Array,
});

module.exports = mongoose.model("MainGraphDataReturn", MainGraphDataReturn);
