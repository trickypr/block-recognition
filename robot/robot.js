// We want to use typescript typechecking in vscode, but don't want to have to
// transpile
// @ts-check

// Assorted nodejs utilities for working with the file system etc
const fs = require("fs");
const { exec } = require("child_process") // Allows for the execution of bash commands

// AI utilities
const tf = require("@tensorflow/tfjs");
const mobileNet = require("@tensorflow-models/mobilenet");
const knn = require("@tensorflow-models/knn-classifier");
const tfnode = require("@tensorflow/tfjs-node");

// Convert exec to a promise function
const execPromise = cmd => new Promise((resolve, reject) => 
  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      reject(err);
    } else if (stderr) {
      reject(stderr);
    } else {
      resolve(stdout);
    }
  }
))

/**
 * I have gotten to used to rust's option for memory stafety, so I have written 
 * a custom implementation
 * 
 * @template T
 */
class Option {
  /**
   * Creates an option instance
   * @param {T?} value The value you want to store
   */
  constructor(value=undefined) {
    this.set(value)
  }

  /**
   * Returns the value or an error
   * 
   * @param {string} errorMessage The error message to print if this fails
   * @returns {T}
   */
  unwrapOrError(errorMessage) {
    if (this.hasValue) {
      return this.value
    } else {
      throw new Error(errorMessage)
    }
  }

  /**
   * Return the value stored or the default value
   * 
   * @param {T} defaultValue The default value if this option is empty
   * @returns {T} The value stored or the default value
   */
  unwrapOr(defaultValue) {
    if (this.hasValue) {
      return this.value
    }

    return defaultValue
  }

  /**
   * Set a value in this option
   * 
   * @param {T?} value The value that should be stored
   */
  set(value=undefined) {
    if (typeof value !== 'undefined') {
      /**
       * @private
       */
      this.value = value;

      /**
       * @private
       */
      this.hasValue = true;
    } else {
      this.hasValue = false;
    }
  }
}

// Assorted constants
const CLASSIFIER_LOCATION = "path/to/classifier.json";

// Store the cnn and classifier here
const netPromise = mobileNet.load();
let net;
let classifier = knn.create();

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

async function main() {
  // This is in an asynchronous function because top level async-await is not
  // stable in node / v8 yet

  console.log("Robot sorter");
  console.log("============");
  console.log();
  process.stdout.write("Loading mobilenet... ");

  // Wait for mobilenet to load before continuing
  net = await netPromise;
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

main();
