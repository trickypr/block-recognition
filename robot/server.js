const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server);

const ml = require("./ml");

const isOnPi = true;

app.use(express.static("public"));

io.on("connection", () => {
  console.log("Front end has started");

  if (isOnPi) {
    ml();
  }
});

server.listen(3000, () =>
  console.log("Please open the web front end on a separate computer at *:3000")
);
