"use strict";
module.change_code = 1;
var _ = require("lodash");
var config = require("./config");

var RIDE_SESSION_KEY = "ride_session";
var RideHelper = require("./ride_helper");

var DatabaseHelper = require('./database_helper');
var databaseHelper = new DatabaseHelper();

var Skill = require("alexa-app");
var skillService = new Skill.app("ride");

skillService.pre = function(request, response, type) {
  databaseHelper.createTable(); //TODO - only do this once.
  if (request.sessionDetails.application.applicationId != config.amazonAppId && request.sessionDetails.application.applicationId!="amzn1.echo-sdk-ams.app.000000-d0ed-0000-ad00-000000d00ebe") {
    // Fail ungracefully
    console.log("Failed to respond due to an invalid applicationId.");
    response.fail("Invalid applicationId");
  }
};

var cancelIntentFunction = function(request, response) {
  response.say("Goodbye!").shouldEndSession(true);
};

skillService.intent("AMAZON.CancelIntent", {}, cancelIntentFunction);
skillService.intent("AMAZON.StopIntent", {}, cancelIntentFunction);

/**
 * get the helper which stores ride data and requests weather, etc. Returns a promise since the data may be found in the session or database.
 * @param request the Alexa request
 * @returns Promise
 */
var getRideHelper = function(request) {
//  if (request === undefined || request.userId === undefined){}
  return databaseHelper.readData(request.userId).then( function(data) {
    return new RideHelper(data);
  }).catch(function(error){
    console.log(error);
    var data = request.session(RIDE_SESSION_KEY) ? request.session(RIDE_SESSION_KEY) : {};
    return new RideHelper(data);
  });
};

skillService.launch(function(request, response) {
  console.log("Fired 'launch'.");
  console.log("Session:");
  console.log(request.session(RIDE_SESSION_KEY));
  getRideHelper(request).then(function(helper){
    if (!helper.zipcode){
      var prompt = "Welcome to Ride. I can tell you if you should ride your bike today. To start, please tell me your zipcode.";
      response.say(prompt).shouldEndSession(false);
      response.send();
    } else {
      helper.getWeather().then(function(data) {
        var responseObject = helper.generateResponse(data);
        console.log(responseObject.speech);
        response.say(responseObject.speech).send();
        response.shouldEndSession(true);
        response.send();
      });
    }
  });
  return false;
});

skillService.intent("AMAZON.HelpIntent", {},
  function(request, response) {
    console.log("Fired 'AMAZON.HelpIntent'.");
    getRideHelper(request).then(function(helper){
      var help = "Welcome to Ride. I can tell you whether or not you should ride your bike today."
      if (helper.zipcode !== null) {
        help += "Your zipcode is currently set to " + helper.zipcode + ". If you'd like to change it, please just say a different five digit zipcode."
      }
      help += "To find out if you should ride your bike today, say 'today'. For tomorrow, say 'tomorrow'."
      //TODO TODO
      response.say(help).shouldEndSession(false);
      response.send();
    });
    return false;
});

skillService.intent("zipcodeIntent", {
  "slots": {
    "zip": "NUMBER"
  }, "utterances": ["My zipcode is {-|zip}", "{It's|it is|for|with|} {-|zip}"]
  }, function(request, response) {
    console.log("Fired 'zipcodeIntent'.");
    getRideHelper(request).then(function(helper){
      var zip = request.data.request.intent.slots.zip.value;
      if( zip && ( zip.length === 5 || ( zip.length === 6 && zip[0] === '4' ) ) ){ // Yucky hack because Alexa hears "4" instead of "for" when asking "Ask for 11215"
        helper.zipcode = zip.length === 5 ? zip : zip.substr(1,5); // Yuck
        var requestedDay = 0;
        if ( !_.isUndefined(request.session(RIDE_SESSION_KEY)) && !_.isUndefined(request.session(RIDE_SESSION_KEY).day) ){
          requestedDay = request.session(RIDE_SESSION_KEY).day;
        }
        helper.day = requestedDay;
        console.log("Zipcode:", helper.zipcode);
        helper.getWeather().then(function(weatherData) {
          var responseObject = helper.generateResponse(weatherData, requestedDay);
          response.say(responseObject.speech).send();
          response.shouldEndSession(true);
          databaseHelper.storeData(request.userId, helper).then(
            function(result) {
              console.log("Storing data for user", request.userId, "after successful zipCodeIntent.");
              console.log(result);
              response.send();
            }).catch(function(error) {
              console.log("Error storing data for user", request.userId, "after successful zipCodeIntent.");
              console.log(error);
              response.send();
            });
        });
      } else {
        response.reprompt("Sorry, I didn't catch that. Please give me a valid five-digit zipcode.");
        response.shouldEndSession(false);
        response.send();
      }
      response.session(RIDE_SESSION_KEY, helper);
    });
    return false;
});

skillService.intent("rideIntent", {
  "slots": {
    "day": "TodayOrTomorrow"
  }, "utterances": ["{should|can} I ride {-|day}", "if I {should|can} ride {-|day}", "{about|with} {-|day}", "{-|day}"]
  }, function(request, response) {
    console.log("Fired 'rideIntent'.");
    getRideHelper(request).then(function(helper){
      var requestedDay = request.data.request.intent.slots.day.value === "tomorrow" ? 1 : 0;
      if (helper.zipcode !== null) {
        helper.getWeather().then(function(weatherData) {
          var responseObject = helper.generateResponse(weatherData, requestedDay);
          response.say(responseObject.speech).send();
          response.shouldEndSession(true);
          response.send();
        });
      } else {
        response.say("What's your zipcode?");
        response.reprompt("I didn't hear anything. Give me your five-digit zipcode to continue.");
        response.shouldEndSession(false);
        response.send();
      }
      response.session(RIDE_SESSION_KEY, helper);
    });
    return false;
});

skillService.sessionEnded(function(request,response) {
/*
  getRideHelper(request).then(function(helper){
    databaseHelper.storeData(request.userId, helper).then(
      function(result) {
        console.log(result);
        return result;
      }).catch(function(error) {
        console.log(error);
      });
  });
  return false;
*/
});

module.exports = skillService;
