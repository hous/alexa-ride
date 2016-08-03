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
  if (request.sessionDetails.application.applicationId!=config.amazonAppId) {
    // Fail ungracefully
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
  })
};

skillService.launch(function(request, response) {
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
    getRideHelper(request).then(function(helper){
      var zip = request.data.request.intent.slots.zip.value;
      if(zip.length === 5) { //TODO no built-in?
        helper.zipcode = zip;
        helper.getWeather().then(function(data) {
          var responseObject = helper.generateResponse(data);
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
        response.reprompt("Sorry, I didn't catch that. Please give me a valid, five-digit zipcode.");
        response.shouldEndSession(false);
      }
      response.session(RIDE_SESSION_KEY, helper);
      response.send();
    });
    return false;
});

skillService.intent("rideIntent", {
  "slots": {
    "day": "TodayOrTomorrow"
  }, "utterances": ["{should|can} I ride {-|day}", "if I {should|can} ride {-|day}", "{about|with} {-|day}", "{-|day}"]
  }, function(request, response) {
    getRideHelper(request).then(function(helper){
      helper.day = request.data.request.intent.slots.day.value === "tomorrow" ? 1 : 0;
      if (helper.zipcode !== null) {
        helper.getWeather().then(function(data) {
          console.log(data);
          var responseObject = helper.generateResponse(data);
          response.say(responseObject.speech).send();
          response.shouldEndSession(true);
          response.send();
          databaseHelper.storeData(request.userId, helper).then(
            function(result) {
              console.log("Storing data for user", request.userId, "after successful zipCodeIntent.");
              console.log(result);
            }).catch(function(error) {
              console.log("Error storing data for user", request.userId, "after successful zipCodeIntent.");
              console.log(error);
            });
        });
      } else {
        response.say("What's your zipcode?");
        response.reprompt("I didn't hear anything. Give me your five-digit zipcode to continue.");
        response.shouldEndSession(false);
        response.send();
      }
    });
    return false;
});

skillService.sessionEnded(function(request,response) {
  getRideHelper(request).then(function(helper){
    console.log("Attempting to store session data.")
    databaseHelper.storeData(request.userId, helper).then(
      function(result) {
        console.log("Result of storeData: ");
        console.log(result);
        return result;
      }).catch(function(error) {
        console.log(error);
      });
  });
  return false;
});

module.exports = skillService;
