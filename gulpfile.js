/**
 * Modified from https://medium.com/@AdamRNeary/a-gulp-workflow-for-amazon-lambda-61c2afd723b6
 */

var gulp = require('gulp');
var gutil = require('gulp-util');
var args   = require('yargs').argv;
var del = require('del');
var install = require('gulp-install');
var zip = require('gulp-zip');
var AWS = require('aws-sdk');
var fs = require('fs');
var runSequence = require('run-sequence');

var CONFIG = require('./apps/ride/config');

/**
 * This will publish a new version of the lambda function to prod.
 *
 * Make sure AWS CLI tools are installed and configured before running this.
 * @see http://aws.amazon.com/sdk-for-node-js/
 *
 * The IAM role associated with the access key/secret that you set up should have access to update the lambda function
 * with the ARN you set up in config.js
 *
 * If you are using multiple AWS credential profiles, you can run the gulp tasks that require AWS connectivity like this:
 *    $ AWS_PROFILE=my_profile_name gulp test
 *    $ AWS_PROFILE=my_profile_name gulp upload
 */
gulp.task('publish', function(callback) {
  return runSequence(
    ['clean'],
    ['zip'],
    ['upload'],
    callback
  );
});

gulp.task('zip', function() {
  return gulp.src('apps/ride/**/*')
    .pipe(zip('archive.zip'))
    .pipe(gulp.dest('dist'));
});

gulp.task('clean', function(cb) {
  del('./dist/archive.zip', cb);
});

/**
 * Uploads a new version of your Lambda function, replacing the existing one.
 * Use "gulp publish" not this.
 * @TODO Make this a function and not a gulp task.
 */
gulp.task('upload', function() {

  AWS.config.region = CONFIG.region;
  var lambda = new AWS.Lambda();
  var functionName = CONFIG.lambdaFunctionName;

  lambda.getFunction({FunctionName: functionName}, function(err, data) {
    if (err) {
      if (err.statusCode === 404) {
        console.log(err);
        var warning = 'Unable to find lambda function ' + deploy_function + '. '
        warning += 'Verify the lambda function name and AWS region are correct.'
        gutil.log(warning);
      } else {
        var warning = 'AWS API request failed. '
        warning += 'Check your AWS credentials and permissions.'
        gutil.log(warning);
      }
    }

    var params = {
      FunctionName: functionName
    };

    fs.readFile('dist/archive.zip', function(err, data) {
      params['ZipFile'] = data;
      lambda.updateFunctionCode(params, function(err, data) {
        if (err) {
          console.log(err);
          console.log(data);
          var warning = 'Package upload failed. '
          warning += 'Check your iam:PassRole permissions.'
          gutil.log(warning);
        }
      });
    });
  });
});

/**
 * Tests a given Alexa intent by firing the Lambda function with a payload.
 * Payloads are defined as sample events in the test/events folder.
 * Defaults to "launchRequest" intent.
 * @example
 *    $ gulp test                 # will test the "launchRequest" intent
 *    $ gulp test myIntentName    # will test the "myIntentName" intent
 */
gulp.task('test', function(callback) {

  var intent = args.intent || "launchRequest";
  AWS.config.region = CONFIG.region;
  var lambda = new AWS.Lambda();
  var payload = fs.readFileSync('test/events/' + intent + '.json', 'utf8');

  gutil.log("Testing with intent '" + gutil.colors.blue(gutil.colors.bold(intent)) + "'.");

  var params = {
    FunctionName : CONFIG.lambdaFunctionARN,
    Payload : payload
  };

  lambda.invoke(params, function(err,data){
    if (err) {
      var warning;
      if (err.statusCode === 404) {
        console.log(err);
        warning = 'Unable to find lambda function ' + deploy_function + '. ' +
          'Verify the lambda function name and AWS region are correct.';
        gutil.log(warning);
      } else {
        warning = 'AWS API request failed. ' +
          'Check your AWS credentials and permissions.';
        gutil.log(warning);
      }
    }

    console.log("The data is:");
    console.log(data);
    if (data.StatusCode !== 200) {
      console.warn("The intent failed. Please check logs.");
    }
  });
});
