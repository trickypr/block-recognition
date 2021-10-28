const express = require("express");
const app = express();
const http = require("http");

const { Server } = require("socket.io");

const ml = require("./ml");

const isOnPi = true;

function setupServer() {
  const server = http.createServer(app);
  const io = new Server(server);

  app.use(express.static("public"));

  io.on("connection", (socket) => {
    console.log("Front end has started");

    if (isOnPi) {
      ml(socket);
    }
  });

  server.listen(3000, () =>
    console.log(
      "Please open the web front end on a separate computer at *:3000"
    )
  );
}

module.exports = setupServer;
