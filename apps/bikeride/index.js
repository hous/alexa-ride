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

var util = require('util');

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
    var data = {};
    if (_.isUndefined(request.session(RIDE_SESSION_KEY))){
      data = request.session(RIDE_SESSION_KEY);
    }
    return new RideHelper(data);
  });
};

skillService.launch(function(request, response) {
  console.log("Fired 'launch'.");
  getRideHelper(request).then(function(helper){
    if (!helper.zipcode){
      var prompt = "Welcome to Ride. I can tell you if you should ride your bike today. To start, please tell me your zipcode.";
      response.say(prompt).shouldEndSession(false);
      response.send();
    } else {
      helper.getWeather().then(function(data) {
        var responseObject = helper.generateResponse(data);
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
      var help = "This is 'Should I Ride', the skill that let's me tell you whether or not you should ride your bike today.";
      if (helper.zipcode !== null) {
        help += " It looks like you've used this skill before, and your zipcode is currently set to <say-as interpret-as='digits'>" + helper.zipcode + "</say-as>."
        + " If you'd like to change it, please just say a different five digit zipcode."
        + " If you'd like to hear my recommendation on whether or not you should ride your bike, just say 'Alexa, ask Should I Ride today', or, 'Alexa, ask Should I Ride tomorrow'.";
        response.say(help).shouldEndSession(true);
        response.send();
      } else {
        help += " To start, please tell me your five digit zipcode.";
        response.say(help).shouldEndSession(false);
        response.send();
      }
    });
    return false;
});

skillService.intent("zipcodeIntent", {
  "slots": {
    "zip": "NUMBER"
  }, "utterances": ["My zipcode is {-|zip}", "{It's|it is|for|with|} {-|zip}"]
  }, function(request, response) {
    console.log("Fired 'zipcodeIntent'.");

//    console.log(util.inspect(request, false, null));

    response.reprompt("Sorry, I didn't catch that. Please give me a valid five-digit zipcode.");

    var zip = null;
    if (_.has(request, 'data.request.intent.slots.zip.value')) {
      zip = request.data.request.intent.slots.zip.value;
      if( zip && ( zip.length === 5 || ( zip.length === 6 && zip[0] === '4' ) ) ){ // Yucky hack because Alexa hears "4" instead of "for" when asking "Ask for 11215"
        zip = zip.length === 5 ? zip : zip.substr(1,5); // I feel dirty
      } else {
        zip = null;
      }
    }

    if ( !_.isNull(zip) ){
      getRideHelper(request).then(function(helper){
        helper.zipcode = zip.length === 5 ? zip : zip.substr(1,5); // Yuck
        var requestedDay = 0;
        if ( !_.isUndefined(request.session(RIDE_SESSION_KEY)) && !_.isUndefined(request.session(RIDE_SESSION_KEY).day) ){
          console.log("request.session(RIDE_SESSION_KEY)");
          console.log(request.session(RIDE_SESSION_KEY));
          requestedDay = request.session(RIDE_SESSION_KEY).day;
        }
        helper.day = requestedDay;
        console.log("Zipcode:", helper.zipcode);
        helper.getWeather().then(function(weatherData) {
          var responseObject = helper.generateResponse(weatherData, requestedDay);
          var daySpeech = requestedDay === 0 ? 'today' : 'tomorrow';
          var ssml = "<speak>I've set your zipcode to <say-as interpret-as='digits'>" + helper.zipcode + "</say-as>. Moving forward, you can just say 'Alexa, ask Should I Ride'. Here's my recommendation for " + daySpeech + ". " + responseObject.speech + "</speak>";
          response.say(ssml).send();
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
        response.session(RIDE_SESSION_KEY, helper);
      });
    } else {
      console.log("Didn't get a valid ZIP.")
      response.say("Please tell me your five digit zipcode.");
      response.shouldEndSession(false, "Sorry, I didn't catch that. Please give me a valid five-digit zipcode.");
      response.send(); 
    }
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
      helper.day = requestedDay;
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
        response.session(RIDE_SESSION_KEY, helper);
        response.shouldEndSession(false);
        response.send();
      }
    });
    return false;
});

skillService.sessionEnded(function(request,response) {
  console.log("Fired 'sessionEnded'.");
});

module.exports = skillService;
