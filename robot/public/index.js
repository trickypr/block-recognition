const classifierLocation = "/classifier.json";

let socket;
let network = mobilenet.load();
let classifier = knnClassifier.create();

async function main() {
  console.log("Connecting to pi...");
  socket = io();

  console.log("Loading classifier...");

  const classifierData = await (await fetch(classifierLocation)).json();

  // Load the classifier from file. This should be trained on the
  // web front end on a more powerful computer
  // https://block-recognition.pages.dev/
  classifier.setClassifierDataset(
    Object.fromEntries(
      classifierData.map(([label, data, shape]) => [
        label,
        tf.tensor(data, shape),
      ])
    )
  );

  console.log("Loading network...");
  await network;

  // Listen for classify message from the server
  socket.on("classify", async (imagePath) => {
    console.log("Loading image...");
    const img = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => {
        console.log(e);
        throw e;
      };
      img.src = imagePath + "?c=" + Math.random() * 10000000;
    });

    console.log("Classifying...");

    // Get the activation from mobilenet from the webcam.
    const activation = (await network).infer(img, true);
    // Get the most likely class and confidence from the classifier module.
    const result = await classifier.predictClass(activation);
    console.log(result);

    // Send the result back to the server
    socket.emit("classified", result.label);
  });
}

main();
