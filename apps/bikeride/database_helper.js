"use strict";

module.change_code = 1;

var _ = require("lodash");
var config = require("./config");
var Helper = require("./ride_helper"); // Move to config
var TABLE_NAME = "rideUserData"; // Move to config
var localUrl = "http://localhost:4000";
var localCredentials = {
  region: config.region,
  accessKeyId: config.accessKeyId,
  secretAccessKey: config.secretAccessKey
};
var localDynasty = require("dynasty")(localCredentials, localUrl);
var dynasty = localDynasty;
//comment line 13 and uncomment line 15 for production
//var dynasty = require("dynasty")({});

function DatabaseHelper() {
}

var getTable = function() {
  return dynasty.table(TABLE_NAME);
};

DatabaseHelper.prototype.createTable = function() {
  console.log("Firing createTable");
  return dynasty.describe(TABLE_NAME)
    .catch(function(error) {
      console.log("createTable::error: ", error);
      return dynasty.create(TABLE_NAME, {
        key_schema: {
          hash: ["userId", "string"]
        }
      });
    });
};

DatabaseHelper.prototype.storeData = function(userId, rideUserData) {
  console.log("writing data to database for user " + userId);
  return getTable().insert({
    userId: userId,
    data: JSON.stringify(madlibData)
  }).catch(function(error) {
    console.log(error);
  });
};

DatabaseHelper.prototype.readData = function(userId) {
  console.log("reading data with user id of : " + userId);
  return getTable().find(userId)
    .then(function(result) {
      var data = (result === undefined ? {} : JSON.parse(result["data"]));
      return new Helper(data);
    }).catch(function(error) {
    console.log(error);
  });
};

module.exports = DatabaseHelper;