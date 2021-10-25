// @ts-check

const { exec } = require("child_process"); // Allows for the execution of bash commands

/**
 * An async version of exec
 *
 * @param {*} cmd The inputs to exec
 * @returns {Promise<string>} The output of the command
 */
const execPromise = (cmd) =>
  new Promise((resolve, reject) =>
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        reject(err);
      } else if (stderr) {
        reject(stderr);
      } else {
        resolve(stdout);
      }
    })
  );

let loggerFunc = null;

function initializeLogger(socket) {
  loggerFunc = (msg = "") => socket.emit("log", msg);
}

function log(msg) {
  console.log(msg);

  if (loggerFunc) {
    loggerFunc(msg);
  }
}

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
  constructor(value = undefined) {
    this.set(value);
  }

  /**
   * Returns the value or an error
   *
   * @param {string} errorMessage The error message to print if this fails
   * @returns {T}
   */
  unwrapOrError(errorMessage) {
    if (this.hasValue) {
      return this.value;
    } else {
      throw new Error(errorMessage);
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
      return this.value;
    }

    return defaultValue;
  }

  /**
   * Set a value in this option
   *
   * @param {T?} value The value that should be stored
   */
  set(value = undefined) {
    if (typeof value !== "undefined") {
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

module.exports = {
  execPromise,
  Option,
  initializeLogger,
  log,
};
