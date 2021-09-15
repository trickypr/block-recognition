// Assorted nodejs utilities for working with the file system etc
const fs = require("fs");

// AI utilities
const tf = require("@tensorflow/tfjs");
const mobileNet = require("@tensorflow-models/mobilenet");
const knn = require("@tensorflow-models/knn-classifier");
const tfnode = require("@tensorflow/tfjs-node");

// Assorted constants
const CLASSIFIER_LOCATION = "path/to/classifier.json";

// Store the cnn and classifier here
let net = mobileNet.load();
let classifier = knn.create();

function captureImage() {
  // TODO: Make this capture and return an image path (requires hardware)
  // Probably using raspi still https://www.raspberrypi.org/documentation/accessories/camera.html#raspistill
}

/**
 * This function will be responsible for classifying the image. It is asynchronous
 * to allow the robot to do other stuff (e.g. move the belt) in the background
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
  net = await net;
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
    const image = captureImage();

    // Start the image classifier the image
    const classPromise = classify(image);

    // Increment the belt
    await incrementBelt();

    // Rotate the bucket to the class
    await rotateBucket(await classPromise);

    // The sorting has completed and the loop can repeat
  }
}

main();
