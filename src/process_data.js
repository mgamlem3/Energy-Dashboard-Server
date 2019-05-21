/**
 * @author Michael Gamlem III
 */

const Constants = require("./constants");

module.exports = {    

    /**
     * @description This function will create graph labels from datapoints given by the database
     * @param {array: Database Entry} values array of Database Entries
     * @param {String} kind kind of label to generate (year, month, hour, day)
     */

    createDatapointLabels : function(values, kind = "year") {
        var labels = [];
        var entry = null;
        var date = null;
        var label = "";

        if (kind == "year") {
            values.forEach(entry => {
                try {
                    var date = new Date(entry.date);
                    label = (date.getMonth() + Constants.ONE) + "/" + date.getFullYear();

                    // if same label exists, don't push it
                    if (labels == [] || label != labels[labels.length - Constants.ONE]) {
                        labels.push(label);
                    }
                } catch (e) {
                    console.error("Error Creating label %s", e);
                }
            });
        } else if (kind == "month") {
            entry = values[0];
            try {
                date = new Date(entry.date);
                label = "";
                while (labels.length != Constants.MONTH_LENGTH) {
                    label = (date.getMonth() + Constants.ONE) + "/" + date.getDate();
                    labels.push(label);
                    date.setDate(date.getDate() - Constants.ONE);
                }
            } catch (e) {
                console.error("Error Creating label %s", e);
            }
        } else if (kind == "hour") {
            entry = values[0];
            try {
                date = new Date(entry.date);
                label = "";
                while (labels.length != Constants.DAY_LENGTH) {
                    label = date.getHours() + ":" + date.getMinutes();
                    labels.push(label);
                    date.setHours(date.getHours() - Constants.ONE);
                }
            } catch (e) {
                console.error("Error Creating label %s", e);
            }
        } 

        return labels;
    },

    /**
     * @description This function is meant to convert all entries from a month into averages that will be returned to the `getMonthAverages()` function. It is not intended to be called by anything else.
     * @param {Object: 3 arrays} arrays must be in the shape of the `ret` object from `getMonthAverages()` above 
     * @returns three arrays with monthly averaged values. (If no data can be found for the month, a zero is entered).
     */

    getMonthlyAverages: function(arrays) {
        var currentMonth = arrays[0].date.getMonth();
        var vals = [];
        var ret = {
            thisYear: [],
            lastYear: [],
            lastLastYear: [],
        };
        try {
            arrays.forEach(element => {
                if (element.date.getMonth() == currentMonth) {
                    vals.push(parseInt(element.peakDemand), Constants.BASE_TEN);
                } else {
                    currentMonth = element.date.getMonth();
                    ret.thisYear.push(average(vals));
                }
            });
            vals = [];
            arrays.forEach(element => {
                if (element.date.getMonth() == currentMonth) {
                    vals.push(parseInt(element.peakDemand), Constants.BASE_TEN);
                } else {
                    currentMonth = element.date.getMonth();
                    ret.lastYear.push(average(vals));
                }
            });
            vals = [];
            arrays.forEach(element => {
                if (element.date.getMonth() == currentMonth) {
                    vals.push(parseInt(element.peakDemand), Constants.BASE_TEN);
                } else {
                    currentMonth = element.date.getMonth();
                    ret.lastLastYear.push(average(vals));
                }
            });

            return ret;
        } catch (e) {
            console.error(e);
        }
    },

    /**
     * @description This function will turn results from the database into three separate year arrays
     * @param {array: Object(database result)} values 
     * @param {Date} dateToCheck current date/time data from `server.js`
     * @returns object with three arrays of monthly averages for each year (thisYear, lastYear, lastLastYear)
     */

    getMonthAverages : function(values, dateToCheck) {
        var ret = {
            thisYear: [],
            lastYear: [],
            lastLastYear: []
        };

        // sort all datapoints into proper year
        try {
            values.forEach(entry => {
                var date = new Date(entry.date);
                if(date >= dateToCheck - Constants.THREE_YEARS_AGO && date <= dateToCheck - Constants.TWO_YEARS_AGO) {

                    // three years old
                    ret.lastLastYear.push(entry);
                } else if (date >= dateToCheck - Constants.TWO_YEARS_AGO && date <= dateToCheck - Constants.ONE_YEAR_AGO) {

                    // two years old
                    ret.lastYear.push(entry);                
                } else if (date >= dateToCheck - Constants.ONE_YEAR_AGO && date <= dateToCheck) {

                    // one year old
                    ret.thisYear.push(entry);
                } else {
                    console.warn("Entry with date %s is not able to be parsed. Is it more than three years old?", entry.date);
                }
            });
        } catch (e) {
            console.error("Error while processing data and sorting into months.\n" + e);
        }

        //get average for each month of the year
        ret = getMonthlyAverages(ret); // eslint-disable-line no-undef

        return ret;
    },

    /**
     * @description This function will turn results from the database into one array of daily averages
     * @param {array: Object(database result)} values 
     * @param {Date} dateToCheck date to compare aginst from `server.js`
     * @returns object with one array of daily average energy use
     */

    getDayAverages : function(values, dateToCheck) {
        var thisMonth = [];

        // get results for this month
        try {

            // current day that is being processed
            var currentDay = values[0].date;
            var tempVals = [];
            values.forEach(entry => {
                var date = new Date(entry.date);

                try {
                    if (daysBetween(date, dateToCheck) <= Constants.MONTH_LENGTH) {
                        if (date == currentDay) {
                            tempVals.push(entry.peakDemand);
                        } else if (date != currentDay) {
                            thisMonth.push(average(tempVals));
                            currentDay = date;
                            tempVals = [];
                            tempVals.push(entry.peakDemand);
                        }
                    }
                } catch (e) {
                    console.error("Error while parsing data point: " + entry + "\n" + e);
                }
            });
        } catch (e) {
            console.error("Error while processing data and sorting into days." + e);
        }

        return thisMonth;
    }, 

    /**
     * @description This function will turn results from the database into one array of hourly averages
     * @param {array: Object(database result)} values 
     * @param {Date} givenDate date to search from
     * @returns object with one array of hourly average energy use
     */

    getHourAverages : function(values, givenDate) {
        var thisDay = [];

        // get results for this day
        try {

            // current day that is being processed
            var currentDate = new Date(values[0].date);
            var currentHour = currentDate.getHours();
            var tempVals = [];
            values.forEach(entry => {
                var date = new Date(entry.date);
                if (date == givenDate) {
                    if (date.getHour() == currentHour.getHours()) {
                        tempVals.push(entry.peakDemand);
                    } else if (date != currentHour) {
                        thisDay.push(average(tempVals));
                        currentHour = date;
                        tempVals = [];
                        tempVals.push(entry.peakDemand);
                    }
                }
            });
        } catch (e) {
            console.error("Error while processing data and sorting into hours." + e);
        }

        return thisDay;
    },

    /**
     * @description This function will return all entries within the past 3 years
     * @param databaseEntries Array of entries returned from the database
     * @returns array of database entries that fall in the last three years
     */

    findLastThreeYears : function(databaseEntries) {
        var ret = [];
        const NOW = new Date();
        databaseEntries.forEach(entry => {
            const entryDate = new Date(entry.date);
            if (entryDate.getFullYear() >= NOW.getFullYear() - Constants.THREE_YEARS_AGO) {
                ret.push(entry);
            }
        });

        return ret;
    }
};

/**
 * @description The below functions are used internally to this file and should not be exported
 */

/**
 * @description This function will average all elements of an array
 * @param {array: Number} values array of numbers
 * @returns average of values or null if error
 * @private
 */

function average(values) {
    var sum = 0;
    var average = 0;
    var length = 0;
    try {
        values.forEach(value => {
            sum = value + sum;
            length++;
        });
        average = sum/length;
    } catch (error) {
        console.error("ERROR: Unable to average values " + error);
        average = null;
    }
    return average;
}

/**
 * @description This function returns the number of days between two days
 * @param {Date} day1 
 * @param {Date} day2 
 * @returns Number
 * @private
 */

function daysBetween(day1, day2) {
    try {
        var difference = Math.abs(day2.getTime() - day1.getTime());
        difference = Math.ceil(difference / Constants.DAYS_BETWEEN_CALCULATION);   
    } catch (error) {
        console.error("ERROR while calculating difference between days: " + error);
        difference = 10000; // eslint-disable-line no-magic-numbers
    }

    // bug? why am I needing to subtract 62?
    return difference-62; // eslint-disable-line no-magic-numbers
}
