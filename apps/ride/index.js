"use strict";
module.change_code = 1;
var _ = require("lodash");
var Skill = require("alexa-app");
var skillService = new Skill.app("ride");
var RideHelper = require("./ride_helper");
var RIDE_SESSION_KEY = "ride_session";

var getRideHelper = function(request) {
  var rideHelperData = request.session(RIDE_SESSION_KEY);
  if (rideHelperData === undefined) {
    rideHelperData = {};
  }
  return new RideHelper(rideHelperData);
};
var cancelIntentFunction = function(request, response) {
  response.say("Goodbye!").shouldEndSession(true);
};

skillService.intent("AMAZON.CancelIntent", {}, cancelIntentFunction);
skillService.intent("AMAZON.StopIntent", {}, cancelIntentFunction);

skillService.launch(function(request, response) {
  var rideHelper = getRideHelper(request);
  if (!rideHelper.zipcode){
    var prompt = "Welcome to Ride. I can tell you if you should ride your bike today. To start, please tell me your zipcode.";
    response.say(prompt).shouldEndSession(false);
  } else {
    rideHelper.getWeather(rideHelper.zipcode).then(function(data){
      var responseObject = rideHelper.generateResponse(data);
      console.log(responseObject.speech);
      response.card("Temperature: " +  responseObject.temperature + ". Humidity: " + responseObject.humidity + ". Pressure: " + responseObject.pressure + ".");
      response.say(responseObject.speech);
      response.shouldEndSession(true);
    });
  }
});

skillService.intent("AMAZON.HelpIntent", {},
  function(request, response) {
    var rideHelper = getRideHelper(request);
    var help = "Welcome to Ride. I can tell you if you should ride your bike today. To start, please tell me your zipcode. TODO. TODO. Fix this.";
    //TODO TODO
    response.say(help).shouldEndSession(false);
  });

skillService.intent("rideIntent", {
  "slots": {
    "DAY": "TodayOrTomorrow"
  }, "utterances": ["{should|can} I ride {-|TodayOrTomorrow}", "if I {should|can} ride {-|TodayOrTomorrow}"]
  }, function(request, response) {
    var rideHelper = getRideHelper(request);
    if (rideHelper.getZipcode()) {
      var responseObject = rideHelper.generateResponse(data);
      console.log(responseObject.speech);
      response.card("Temperature: " +  responseObject.temperature + ". Humidity: " + responseObject.humidity + ". Pressure: " + responseObject.pressure + ".");
      response.say(responseObject.speech);
      response.shouldEndSession(true);
    } else {
      response.say("What's your zipcode?");
      response.reprompt("I didn't hear anything. Give me your five-digit zipcode to continue.");
      response.shouldEndSession(false);
    }
    response.session(RIDE_SESSION_KEY, rideHelper);
  }
);

skillService.intent("zipcodeIntent", {
  "slots": {
    "zip": "NUMBER"
  }, "utterances": ["{-|zip}"]
  }, function(request, response) {
    var rideHelper = getRideHelper(request),
      zip = request.data.request.intent.slots.zip.value;

    if(zip.length === 5) { //TODO no built-in?
      console.log("Got a valid zipcode.");
      rideHelper.storeZip(zip);

      rideHelper.getWeather(zip).then(function(data) {
        var responseObject = rideHelper.generateResponse(data);
        console.log(responseObject.speech);
        response.card("Temperature: " +  responseObject.temperature + ". Humidity: " + responseObject.humidity + ". Pressure: " + responseObject.pressure + ".");
        response.say(responseObject.speech).send();
        response.shouldEndSession(true);
      });
    } else {
      response.reprompt("Sorry, I didn't catch that. Please give me a valid, five-digit zipcode.");
      response.shouldEndSession(false);
      return true;
    }
    response.session(RIDE_SESSION_KEY, rideHelper);
    return false;
  }
);

module.exports = skillService;
