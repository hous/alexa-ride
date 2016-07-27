'use strict';
module.change_code = 1;
var _ = require('lodash');
var requestPromise = require('request-promise');

var ENDPOINT = 'http://api.openweathermap.org/data/2.5/forecast/daily?appid=18c311dc5e30277498b3a08f7cb0c4e3&cnt=2&units=imperial&zip=';
// Get two days. TODO make sure day 1 is today not tomorrow.
// TODO save Celsius or Fahrenheit units=imperial / units=metric
// TODO use weather condition codes - http://openweathermap.org/weather-conditions


function RideHelper (obj) {
  this.unit = "F";
  this.zipcode = null; //TODO - check session
  this.day = 0; //0 for today, 1 for tomorrow (based on API response index)
  for (var prop in obj) this[prop] = obj[prop];
}

RideHelper.prototype.getZipcode = function() {
  return this.zipcode;
};

RideHelper.prototype.storeZip = function(zip) {
  this.zipcode = zip;
  //TODO - write to DB
};

RideHelper.prototype.getWeather = function(zip) {
  var options = {
    method: 'GET',
    uri: ENDPOINT + zip,
    json: true
  };
  return requestPromise(options);
};

// TODO - work on dew point calculation
RideHelper.prototype.generateResponse = function(result) {
  var template = _.template('The temperature is ${temperature}, dew point is ${dewPoint}.'),
    data = {
      temperature : result.list[this.day].temp.day,
      pressure : result.list[this.day].pressure,
      humidity : result.list[this.day].humidity
    };

  console.log(this.unit);
  var tempInC = this.unit === "F" ? this.fToC(data.temperature) : data.temperature;

  console.log(tempInC);

  data.temperature = 95;
  data.humidity = 35;
  data.dewPoint = this.getDewpoint(data.temperature, data.humidity);
//  data.dewPoint = 243.04 * Math.log(data.humidity / 100) + (( 17.625 * tempInC) / (243.04 + tempInC)) / (17.625 - Math.log(data.humidity / 100) - ((17.625 * tempInC) / (243.04 + tempInC)));

  data.speech = template(data);

  return data;
};

RideHelper.prototype.getDewpoint = function(temperature, humidity) {
  var temp = -1.0 * temperature;
  var es = 6.112*Math.exp(-1.0*17.67*temp/(243.5 - temp));
  var ed = humidity/100.0 * es;
  var eln = Math.log(ed/6.112);
  return -243.5*eln/(eln - 17.67 );
};

RideHelper.prototype.fToC = function(f) {
  return (f - 32) * 5 / 9;
};

RideHelper.prototype.cToF = function(c) {
  return c * (9 / 5) + 32;
};

module.exports = RideHelper;

// Calculate Dew Point from Temp and Humidity
// 243.04*(LN(RH/100)+((17.625*T)/(243.04+T)))/(17.625-LN(RH/100)-((17.625*T)/(243.04+T)))
