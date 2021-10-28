// We want to use typescript typechecking in vscode, but don't want to have to
// transpile
// @ts-check

// =============================================================================
// Imports

// Assorted nodejs utilities for working with the file system etc
const fs = require("fs");

// Raspberry Pi specific utilities
const { Gpio } = require("onoff");
const PWMGpio = require("pigpio").Gpio;

// Custom utilities for this program
const { execPromise, Option, initializeLogger, log } = require("./utils");

// =============================================================================
// Constant config variables

// ------------
// ML constants

/**
 * Location of the classifier file exported from the web trainer
 */
const CLASSIFIER_LOCATION = "./classifier.json";

// ------------------
// Hardware constants

/**
 * The pin that the motor for rotating the conveyer belt is connected to
 */
const BELT_MOTOR_PINS = [6, 13, 19, 26];

/**
 * The amount of times the stepper needs to run to increment once
 */
const BELT_FULL_ROTATION = 3500;

const BELT_SPEED = 2;

/**
 * The pin the servo motor for spinning the bucket will be connected to
 */
const SERVO_PIN = 4;

/**
 * How long it takes in seconds for the servo to go from 0 to 180 degrees (ms)
 */
const SERVO_TIMEOUT = 2000;

/**
 * The angles that the servo should go to for each category
 */
const SERVO_ANGLES = {
  1: 0,
  2: 45,
  3: 90,
  4: 135,
  5: 180,
};

// =============================================================================
// Global variables
// let net;
// let classifier = knn.create();

// =============================================================================
// Main loop

async function main(socket) {
  // This is in an asynchronous function because top level async-await is not
  // stable in node / v8 yet

  initializeLogger(socket);

  log("Robot sorter");
  log("============");
  log();
  log("Self test");
  log("Belt...");
  await incrementBelt();
  log("Servo...");
  for (const bucket in SERVO_ANGLES) {
    log(bucket);
    await rotateBucket(bucket);
  }

  while (true) {
    log("Capturing image...");

    // Capture an image from the robot's camera
    const image = await captureImage();

    log("Classifying image...");

    // Start the image classifier the image
    const classPromise = classify(
      image.unwrapOrError("No image captured"),
      socket
    );

    // Increment the belt
    await incrementBelt();

    // Rotate the bucket to the class
    await rotateBucket(await classPromise);

    await classPromise;

    // The sorting has completed and the loop can repeat
  }
}

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
    if (fs.existsSync("public/currentBlock.jpg"))
      fs.unlinkSync("public/currentBlock.jpg");

    const consoleOutput = await execPromise(
      "raspistill -n -o public/currentBlock.jpg --width 1000 --height 1000"
    );

    // If there was an output from raspistill, output it to the console
    if (consoleOutput && consoleOutput != "") {
      log("raspistill:");
      log(consoleOutput);
    }

    // Set the image path. This is relative to the express web server, not the
    // file system
    path.set("/currentBlock.jpg");
  } catch (err) {
    // If there was an error, place it here

    log("Raspistill triggered an error.");
    log(err);
  }

  return path;
}

const classes = {
  1: "axel",
  2: "connectors",
  3: "decorations",
  4: "fasteners",
  5: "gears",
};

/**
 * This function will be responsible for classifying the image. It is asynchronous
 * to allow the robot to do other stuff (e.g. move the belt) in the background
 *
 * As this program is running on the main thread and is fairly performance heavy,
 * it may freeze the nodejs event loop. I have not gotten a chance to test this,
 * however, if it happens, this function should be moved to another thread. See:
 * https://stackoverflow.com/questions/60098884/how-to-use-multi-threads-or-processes-in-nodejs
 *
 * @param {string} imagePath An option for the path to the image
 */
async function classify(imagePath, socket) {
  const classifyPromise = new Promise((resolve, reject) => {
    socket.once("classified", (data) => {
      log(`Classified: ${classes[Number(data)]}`);

      resolve(data);
    });
  });

  socket.emit("classify", imagePath);

  return classifyPromise;
}

const beltMotorControl = [];

for (const pin of BELT_MOTOR_PINS) {
  beltMotorControl.push(new Gpio(pin, "out"));
}

async function incrementBelt() {
  // This code has been adapted from the freenove tutorial
  // https://raw.githubusercontent.com/Freenove/Freenove_Ultimate_Starter_Kit/master/Tutorial.pdf

  let out = 0x01;

  // Define a variable, use four low bit to indicate the state of port
  moveBeltOne();

  await sleep(BELT_SPEED);

  // Move belt the defined number of times
  for (let i = 0; i < BELT_FULL_ROTATION; i++) {
    moveBeltOne();
    await sleep(BELT_SPEED);
  }

  function moveBeltOne() {
    // Decide the shift direction according to the rotation direction
    if (false) {
      // ring shift left
      out != 0x08 ? (out = out << 1) : (out = 0x01);
    } else {
      // ring shift right
      if (out != 0) {
        out = out >> 1;
      } else {
        out = 0x08;
      }
    }

    // Output signal to each port
    for (let i = 0; i < 4; i++) {
      beltMotorControl[i].writeSync(out & (0x01 << i) ? Gpio.HIGH : Gpio.LOW);
    }
  }

  // Reset all of the pins to 0
  for (const pin of beltMotorControl) {
    pin.writeSync(Gpio.LOW);
  }
}

let servo = new PWMGpio(SERVO_PIN, { mode: PWMGpio.OUTPUT });

/**
 *
 * @param {string} targetClass The class to rotate to
 */
async function rotateBucket(targetClass) {
  // Get the angle for the target class
  const angle = SERVO_ANGLES[Number(targetClass)];

  // Check the angle
  if (angle < 0 || angle > 180) {
    throw new Error("Invalid angle");
  }

  console.log(`Rotating to ${angle}`);

  // Calculate target pulse width for servo
  const targetPulseWidth = Math.round((angle / 180) * 1000 + 1000);

  console.log(targetPulseWidth);

  // Write
  servo.servoWrite(targetPulseWidth);

  await new Promise((resolve) => setTimeout(resolve, SERVO_TIMEOUT));
}

// Start the program
module.exports = main;

/**
 * Sleep for a given number of milliseconds
 * @param {number} arg0
 * @returns {Promise<void>}
 */
function sleep(arg0) {
  return new Promise((resolve) => setTimeout(resolve, arg0));
}
