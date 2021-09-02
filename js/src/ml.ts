import * as tf from "@tensorflow/tfjs";
import { load, MobileNet } from "@tensorflow-models/mobilenet";
import { create } from "@tensorflow-models/knn-classifier";

import catagories from "../public/contents.json";

let net: MobileNet;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function app() {
  console.log("Loading mobilenet...");

  const netPromise = load();
  const classifier = create();
  net = await netPromise;
  console.log("Successfully loaded model");

  console.log(catagories);

  async function addItem(classId: number, path: string) {
    const url = path.replace("../", "/");

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => {
        console.log(e);
        throw e;
      };
      img.src = url;
    });

    const tensor = tf.browser.fromPixels(img);
    const activation = net.infer(tensor, true);
    classifier.addExample(activation, classId.toString());

    img.remove();
    tensor.dispose();
  }

  let classes = new Map();
  const classExamples = [];

  for (let classId = 0; classId < catagories.children.length; classId++) {
    const thisClass = catagories.children[classId];

    if (!thisClass.children || thisClass.name == "tests") {
      continue;
    }

    classes.set(classId.toString(), thisClass.name);

    for (const example of thisClass.children) {
      classExamples.push(addItem(classId, example.path));
    }
  }

  await Promise.all(classExamples);

  function confidence(confidence: { [label: string]: number }): string {
    let out = "\n";

    for (const label in confidence) {
      out += `    ${classes.get(label)}: ${confidence[label]}\n`;
    }

    return out;
  }

  const testEl = document.getElementById("testingImage") as HTMLImageElement;
  const testImg = tf.browser.fromPixels(testEl);

  // Get the activation from mobilenet from the webcam.
  const activation = net.infer(testImg, true);
  // Get the most likely class and confidence from the classifier module.
  const result = await classifier.predictClass(activation);

  console.log(
    `Prediction:  ${classes.get(result.label)}
Probability: ${confidence(result.confidences)}`
  );

  console.log(classifier.getClassifierDataset());
}

app();
