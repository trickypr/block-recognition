// We want to use typescript typechecking in vscode, but don't want to have to
// transpile
// @ts-check

// =============================================================================
// Imports

// Assorted nodejs utilities for working with the file system etc
const fs = require("fs");

// AI utilities
const tf = require("@tensorflow/tfjs");
const mobileNet = require("@tensorflow-models/mobilenet");
const knn = require("@tensorflow-models/knn-classifier");
const tfnode = require("@tensorflow/tfjs-node");

// Custom utilities for this program
const { execPromise, Option } = require("./utils")



// =============================================================================
// Constant config variables

// ------------
// ML constants

/**
 * Location of the classifier file exported from the web trainer
 */
const CLASSIFIER_LOCATION = "path/to/classifier.json";

// ------------------
// Hardware constants

/**
 * The pin that the motor for rotating the conveyer belt is connected to
 */
const BELT_MOTOR_PIN = 1;

/**
 * The sensor pin for the belt
 */
const BELT_SENSOR_PIN = 1;

/**
 * The binary value on the belt sensor pin when the belt should stop
 */
const BELT_SENSOR_STOP = false

/**
 * The pin the servo motor for spinning the bucket will be connected to
 */
const SERVO_PIN = 1;

/**
 * The angles that the servo should go to for each category
 */
const SERVO_ANGLES = {
  "1": 0,
  "2": 45,
  "3": 90,
  "4": 135,
  "5": 180,
}



// =============================================================================
// Global variables
let net;
let classifier = knn.create();



// =============================================================================
// Main loop

async function main() {
  // This is in an asynchronous function because top level async-await is not
  // stable in node / v8 yet

  console.log("Robot sorter");
  console.log("============");
  console.log();
  process.stdout.write("Loading mobilenet... ");

  // Wait for mobilenet to load before continuing
  net = await mobileNet.load();
  process.stdout.write("Done\n");
  process.stdout.write("Loading classifier... ");

  // Load the classifier from file. This should be trained on the
  // web front end on a more powerful computer
  // https://block-recognition.pages.dev/
  classifier.setClassifierDataset(
    Object.fromEntries(
      JSON.parse(fs.readFileSync(CLASSIFIER_LOCATION).toString()).map(
        ([label, data, shape]) => [label, tf.tensor(data, shape)]
      )
    )
  );

  process.stdout.write("Done\n");

  while (true) {
    // Capture an image from the robot's camera
    const image = await captureImage();

    // Start the image classifier the image
    const classPromise = classify(image.unwrapOrError("No image captured"));

    // Increment the belt
    await incrementBelt();

    // Rotate the bucket to the class
    await rotateBucket(await classPromise);

    // The sorting has completed and the loop can repeat
  }
}

main()



// =============================================================================
// Step functions

/**
 * Uses `raspistill` to capture an image from the webcam. This is non-blocking and
 * may not return an output if there is an error
 * 
 * `raspistill` docs: https://www.raspberrypi.org/documentation/accessories/camera.html#raspistill
 * 
 * @returns {Promise<Option<string>>} An option for the path to the image
 */
async function captureImage() {
  // If an error occurs, we will not return a value, so we want to use an option
  const path = new Option();
  
  try {
    const consoleOutput = await execPromise("raspistill -o currentBlock.jpg");
    
    // If there was an output from raspistill, output it to the console
    if (consoleOutput && consoleOutput != "") {
      console.log("raspistill:")
      console.log(consoleOutput);
    }

    // Set the image path
    path.set("currentBlock.jpg");
  } catch (err) {
    // If there was an error, place it here

    console.error("Raspistill triggered an error.")
    console.log(err);
  }

  return path
}

/**
 * This function will be responsible for classifying the image. It is asynchronous
 * to allow the robot to do other stuff (e.g. move the belt) in the background
 * 
 * @param {string} imagePath An option for the path to the image
 */
async function classify(imagePath) {
  // Load the image from the local file system and convert it to a tensor (nodejs only)
  const imageBuffer = fs.readFileSync(imagePath);
  const image = tfnode.node.decodeImage(imageBuffer);

  // Collet the activations from mobilenet and pass that through
  // pretrained classifier
  const activation = (await net).infer(image);

  return await classifier.predictClass(activation);
}

async function incrementBelt() {
  // TODO: Increment belt (requires hardware)
}

async function rotateBucket(class) {
  // TODO: Rotate bucket (requires hardware)
}
