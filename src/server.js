// modified from: https://medium.com/javascript-in-plain-english/full-stack-mongodb-react-node-js-express-js-in-one-simple-app-6cc8ed6de274
/* eslint-disable no-undef */

const mongoose = require("mongoose");
const sanitize = require("mongo-sanitize");
const express = require("express");
var cors = require("cors");
const bodyParser = require("body-parser");
const logger = require("morgan");
const Data = require("./Schemas/data");
const Power = require("./Schemas/power_cost");
const ProcessData = require("./process_data");
const Constants = require("./constants");
const MainGraphDataReturn = require("./MainGraphDataReturn");

const API_PORT = 5001;
const app = express();
app.use(cors());
const router = express.Router();
const dbRoute = "mongodb://localhost:27017/energy-dashboard-test";

// connects our back end code with the database
mongoose.connect(
    dbRoute,
    { useNewUrlParser: true }
);

let db = mongoose.connection;

db.once("open", () => console.log("connected to the database")); // eslint-disable-line no-console
db.on("error", console.error.bind(console, "MongoDB connection error:")); 

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(logger("dev"));

/**
 * @deprecated As of now has no use
 * @description Returns entirety of the database
 */

router.get("/getData", (req, res) => {
    Data.find((err, data) => {
        if (err) return res.json({ success: false, error: err });
        console.warn("This method is deprecated and will be removed in a future version");
        return res.json({ success: true, data: data, warning: "This method is deprecated and will be removed in a future version" });
    });
});

/**
 * @description This method updates data in the database by over-writing it
 */

router.post("/updateData", (req, res) => {
    const { id, update } = sanitize(req.body);
    Data.findOneAndUpdate(id, update, err => {
        if (err) return res.json({ success: false, error: err });
        return res.json({ success: true });
    });
});

/**
 * @description This method removes data from the database
 */

router.delete("/deleteData", (req, res) => {

    // const { id } = req.body;
    // Data.findOneAndDelete(id, err => {
    //     if (err) return res.send(err);
    //     return res.json({ success: true });
    // });
    res.status = 405;
    return res.json({
        success: false,
        error: "Data is not able to be deleted"
    });
});

/**
 * @description This method adds new data to the database
 */

router.post("/putData", (req, res) => {
    let data = new Data();

    const { date, buildingName, peakDemand, peakTime, monthlyConsumption } = sanitize(req.body);
    if (!buildingName) {
        console.error("Error no building name specified");
        res.statusCode = 400;
        res.statusMessage = "empty building field";
        return res.json({
            success: false,
            error: "INVALID INPUTS"
        });
    }

    // fill fields
    try {
        data.date = new Date(date);
        data.building = buildingName;
        data.peakDemand = peakDemand;
        data.peakTime = new Date(peakTime);
        data.monthlyConsumption = monthlyConsumption;
    } catch (e) {
        console.error(e);
        return res.json({
            success: false,
            error: "INVALID INPUTS - Try checking to ensure you are passing a string that can be converted to a JavaScript Date type"
        });
    }

    // save object
    data.save(err => {
        if (err) return res.json({ success: false, error: err });
        res.statusCode = 201;
        return res.json({ success: true });
    });
});

/**
 * @description this function will get the most recent entry for a building
 */

router.get("/mostRecent", (req, res) => {
    const LIMIT = 1;
    const building = sanitize(req.query.building);

    if(!building) {
        res.status = 400;
        return res.json({
            success: false,
            error: "building is not defined"
        });
    }

    var query = Data.find({building: new RegExp(building, "i")}).sort("-date").limit(LIMIT);

    query.exec(function (err, result) {
        if(err) {
            res.status = 500;
            return res.json({
                success: false,
                error: err
            });
        } else if (result == null) {
            res.status = 404;
            return res.json({
                success: true,
                mesage: "no data found with this query"
            });
        }
        res.status = 200;
        return res.json({
            success: true,
            data: result
        }); 
    });
});

/**
 * @description this function will get the most recent entry for a building
 */

router.get("/mostRecentMultiple", (req, res) => {
    const building = sanitize(req.query.building);
    const count = sanitize(parseInt(req.query.count, 10));

    if(!building || !count) {
        res.status = 400;
        return res.json({
            success: false,
            error: "improper query parameters"
        });
    }

    var query = Data.find({building: new RegExp(building, "i")}).sort("-date").limit(count);

    query.exec(function (err, result) {
        if(err) {
            res.status = 500;
            return res.json({
                success: false,
                error: err
            });
        } else if (result == null) {
            res.status = 404;
            return res.json({
                success: true,
                mesage: "no data found with this query"
            });
        }
        res.status = 200;
        return res.json({
            success: true,
            data: result
        }); 
    });
});

/**
 * @description this function will get the most used data by the graphs on the webpage
 */

router.get("/getMainGraphData", (req, res) => {
    const building = sanitize(req.query.building);
    const TODAY = new Date();
    var NOW = {
        day: TODAY.getDay(),
        month: TODAY.getMonth(),
        year: TODAY.getFullYear(),
        hour: TODAY.getHours(),
        today: TODAY,
        lastYear: new Date(),
        lastLastYear: new Date()
    };
    NOW.lastYear.setFullYear(NOW.lastYear.getFullYear() - Constants.ONE_YEAR);
    NOW.lastLastYear.setFullYear(NOW.lastLastYear.getFullYear() - Constants.TWO_YEARS);

    var ret = new MainGraphDataReturn();

    // check to see if building has been given as QP
    if(!building) {
        res.status = 400;
        return res.json({
            success: false,
            error: "YOU MUST INCLUDE A BUILDING NAME"
        });
    }

    // ask for data in past three years
    var query = Data.find({
        building: new RegExp(building, "i"),
    }).sort("-date");

    query.exec(function (err, result) {
        if(err) {
            res.status = 500;
            return res.json({
                success: false,
                error: err
            });
        } else if (result == null || result == []) {
            res.status = 404;
            return res.json({
                success: true,
                mesage: "no data found with this query"
            });
        }
        
        // get data and labels
        try {
            var arrays = ProcessData.findLastThreeYears(result);

            // get monthly averages and labels
            var averages = ProcessData.getMonthlyAverages(arrays);
            ret.thisYearData = averages.thisYear;
            ret.lastYearData = averages.lastYear;
            ret.lastLastYearData = averages.lastLastYear;
            ret.yearLabels = ProcessData.createDatapointLabels(arrays, "year");

            // get last 30 days averages and labels
            ret.lastMonthData = ProcessData.getDayAverages(arrays, NOW.today);
            ret.lastYearLastMonthData = ProcessData.getDayAverages(arrays, NOW.lastYear);
            ret.lastLastYearLastMonthData = ProcessData.getDayAverages(arrays, NOW.lastLastYear);
            ret.monthLabels = ProcessData.createDatapointLabels(arrays, "month");

            // get last 24 hours averages and labels
            ret.last24HoursData = ProcessData.getHourAverages(arrays, NOW.today);
            ret.lastYear24HoursData = ProcessData.getHourAverages(arrays, NOW.lastYear);
            ret.lastLastYear24HoursData = ProcessData.getHourAverages(arrays, NOW.lastLastYear);
            ret.hourLabels = ProcessData.createDatapointLabels(arrays, "hour");
        } catch (e) {
            console.error("Error processing request in /getMainGraphData:\n" + e );
            res.status = 500;
            return res.json({
                success: true,
                mesage: "ERROR WHILE PROCESSING REQUEST:" + e,
            });
        }

        res.status = 200;
        return res.json({
            success: true,
            objectReturn: {
                data: [
                    thisYearData = ret.thisYearData,
                    lastYearData = ret.lastYearData,
                    lastLastYearData = ret.lastLastYearData,
                    lastMonthData = ret.lastMonthData,
                    lastYearLastMonthData = ret.lastYearLastMonthData,
                    lastLastYearLastMonthData = ret.lastLastYearLastMonthData,
                    last24HoursData = ret.last24HoursData,
                    lastYearLast24HoursData = ret.lastYearLast24HoursData,
                    lastLastYear24HoursData = ret.lastLastYearLast24HoursData
                ],
                labels: [
                    hourLabels = ret.hourLabels,
                    monthLabels = ret.monthLabels,
                    yearLabels = ret.yearLabels
                ]
            }
        }); 
    });
});

/**
 * @description This function will update the power cost in the database
*/

router.post("/powerCost", (req, res) => {
    var cost = sanitize(req.body.cost);

    if (!cost) {
        res.status = 400;
        return res.json({
            success: false,
            error: "COST IS IMPROPER OR NOT INCLUDED",
        });
    }

    var powerUpdate = new Power({ cost: cost, date: new Date()});

    powerUpdate.save(function(error) {
        if (error) {
            res.json({
                success: false,
                error: error,
                status: 500
            });
        } else {
            res.json({
                success: true,
                status: 200
            });
        }
    });
    
    return res;
});

router.get("/powerCost", (req, res) => {
    const LIMIT = 1;
    var query = Power.find({}).sort("-date").limit(LIMIT);

    query.exec(function (err, result) {
        if (err) {
            return res.json({ success: false, error: err });
        } else if (result == []) {
            res.json({ status: 404, success: false, message: "Unable to find data" });
        } else { 
            res.json({ success: true, data: result });
        }
        return res;
    });
});

// append /api for our http requests
app.use("/api", router);

// launch our backend into a port
app.listen(API_PORT, () => console.log(`LISTENING ON PORT ${API_PORT}`)); // eslint-disable-line no-console
