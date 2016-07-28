'use strict';
module.change_code = 1;
var _ = require('lodash');
var requestPromise = require('request-promise');

var ENDPOINT = 'http://api.openweathermap.org/data/2.5/forecast/daily?appid=18c311dc5e30277498b3a08f7cb0c4e3&cnt=5&units=imperial&zip=';
// Get two days.
// TODO save Celsius or Fahrenheit units=imperial / units=metric


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
  this.day = 0;
  var data = {
    date : new Date(result.list[this.day].dt * 1000).toString(),
    temperature : Math.ceil((result.list[this.day].temp.day + result.list[this.day].temp.eve + result.list[this.day].temp.morn) / 3),
    pressure : result.list[this.day].pressure,
    humidity : result.list[this.day].humidity,
    weatherId : parseInt(result.list[this.day].weather[0].id, 10)
  };

  data.dewPoint = this.getDewpoint(data.temperature, data.humidity) + 2; // Calc is a little inaccuracte, pad by 2 to be safe. "better safe than sweaty"

  // data.dewPointAlt = this.cToF(243.04 * (Math.log(data.humidity / 100) + (( 17.625 * tempInC) / (243.04 + tempInC))) / (17.625 - Math.log(data.humidity / 100) - ((17.625 * tempInC) / (243.04 + tempInC))));

  var tempInC = this.unit === "F" ? this.fToC(data.temperature) : data.temperature;

  var template = _.template('The temperature is ${temperature}, dew point is ${dewPoint}.');

  console.log(data);

  // TODO - change copy to be today or tomorrow
  console.log((200 <= data.weatherId <= 232 || 958 <= data.weatherId <= 961));

  if (200 <= data.weatherId && data.weatherId <= 232 || 958 <= data.weatherId && data.weatherId <= 961){
    template = _.template("It looks like there'll be a thunderstorm, you should probably leave the bike at home.");
  } else if (300 <= data.weatherId && data.weatherId <= 321 || data.weatherId == 500) {
    template = _.template("It's looking like there'll be some light rain today, but nothing too crazy. You could probably go for it if you don't mind getting a little wet.");
  } else if (501 <= data.weatherId && data.weatherId <= 531) {
    template = _.template("It's going to rain today, so you might want to leave the bike at home.");
  } else if (data.weatherId <= 600) {
    template = _.template("You can expect a little snow today. Nothing crazy, so it could be OK, but it's up to you.");
  } else if (601 <= data.weatherId && data.weatherId <= 622) {
    template = _.template("It's going to snow today, you should probably leave the bike at home.");
  } else if (data.weatherId == 781 || data.weatherId == 900) {
    template = _.template("There is a tornado warning in effect. Definitely don't go out riding today.");
  } else if (901 <= data.weatherId && data.weatherId <= 902 || data.weatherId == 962) {
    template = _.template("There is a hurricane warning in effect. Definitely don't go out riding today.");
  } else if (data.temperature < 28){
    template = _.template("You could go for it, but it's going to be pretty cold - around ${temperature} degrees. Make sure to bundle up.");
  } else if (data.temperature < 45){
    template = _.template("Go for it. It might get a little chilly though, with a temperature of around ${temperature} degrees.");
  } else if (85 <= data.temperature <= 93) {
    if (data.dewPoint > 66) {
      template = _.template("I would advise against it. It is going to be pretty hot and muggy out there - around ${temperature} degrees with a dew point of ${dewPoint}.");
    } else {
      template = _.template("Well, it's going to be pretty hot out there, but shouldn't be too sticky, so you could go for it - The temperature's around ${temperature} degrees with a dew point of ${dewPoint}.");
    }
  } else if (data.temperature > 93 ) {
    template = _.template("Probably not a good idea. It is going to be really hot out - around ${temperature} degrees.");
  } else if (75 < data.temperature <= 85 ) {
    if (data.dewPoint > 66) {
      template = _.template("I would advise against it. It's not going to be super hot, but it will get pretty sticky. The temperature will be around ${temperature} degrees with a dew point of ${dewPoint}.");
    } else {
      template = _.template("Go for it. It might be a little hot but it is dry. The temperature's around ${temperature} degrees with a dew point of ${dewPoint}.");
    }
  } else if ( 70 < data.temperature <= 75 ) {
    if (data.dewPoint > 66) {
      template = _.template("I would advise against it. It's not going to be super hot, but it will get pretty sticky. The temperature will be around ${temperature} degrees with a dew point of ${dewPoint}.");
    } else {
      template = _.template("Go for it. It is looking like it will be a beautiful day to ride, with a temperature around ${temperature} degrees.");
    }
  } else {
    template = _.template("Go for it. It is looking like it will be a beautiful day to ride, with a temperature around ${temperature} degrees.");
  }

  data.speech = template(data);

  return data;
};

RideHelper.prototype.getDewpoint = function(temperature, humidity) {
  var temp = -1.0 * temperature;
  var es = 6.112*Math.exp(-1.0*17.67*temp/(243.5 - temp));
  var ed = humidity/100.0 * es;
  var eln = Math.log(ed/6.112);
  return Math.ceil(-243.5*eln/(eln - 17.67 )) + 1;
};

RideHelper.prototype.fToC = function(f) {
  return (f - 32) * 5 / 9;
};

RideHelper.prototype.cToF = function(c) {
  return c * (9 / 5) + 32;
};

module.exports = RideHelper;