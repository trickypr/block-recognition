const { Command } = require("commander");
const fs = require("fs");

const createServer = require("./server");
const { execPromise } = require("./utils");

const program = new Command();

program
  .description("Image classifier that runs on a raspberry pi")
  .addHelpCommand();

program
  .command("run")
  .description(
    "Starts the primary robot process and web server. Requires an external computer running firefox to perform image classification"
  )
  .action(() => createServer());

program
  .command("data <category>")
  .description("Captures data to train the robot on")
  .action(async (category) => {
    fs.mkdirSync(`./data/${category}`, { recursive: true });
    let i = 0;

    while (true) {
      await execPromise(
        `raspistill -n -o data/${category}/${i}.jpg --width 1000 --height 1000 --timeout 0`
      );

      i++;
    }
  });
