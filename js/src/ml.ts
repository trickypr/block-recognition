import * as tf from "@tensorflow/tfjs";
import { load, MobileNet } from "@tensorflow-models/mobilenet";
import { create, KNNClassifier } from "@tensorflow-models/knn-classifier";

import catagories from "./public/contents.json";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

class FeedbackConsole {
  private el: HTMLElement;

  constructor(id: string) {
    this.el = document.getElementById(id);
  }

  append(text: string) {
    this.el.innerHTML += `<br>${text}`;
    console.log(text);
  }

  setRaw(text: string) {
    this.el.innerHTML = `<pre>${text}</pre>`;
    console.log(text);
  }

  clear() {
    this.el.innerHTML = "";
  }
}

class Trainer {
  private network: Promise<MobileNet>;
  private classifier: KNNClassifier;

  private classes = new Map();

  private stateOutput = new FeedbackConsole("exampleOutput");
  private modelOutput = new FeedbackConsole("model");

  constructor() {
    // Load mobilenet
    this.network = load();

    // Create the classifier
    this.classifier = create();

    this.stateOutput.append("Trainer ready");
  }

  async start() {
    this.stateOutput.append("Loading mobilenet...");

    // Wait for mobilenet to be done downloading
    await this.network;

    this.stateOutput.append("Mobilenet loaded");

    // Load and train examples
    await this.loadExamples();

    // Output the model values
    this.modelOutput.setRaw(
      JSON.stringify(
        Object.entries(this.classifier.getClassifierDataset()).map(
          ([label, data]) => [label, Array.from(data.dataSync()), data.shape]
        )
      )
    );

    // Classify example
    const testEl = document.getElementById("testingImage") as HTMLImageElement;
    const testImg = tf.browser.fromPixels(testEl);

    // Get the activation from mobilenet from the webcam.
    const activation = (await this.network).infer(testImg, true);
    // Get the most likely class and confidence from the classifier module.
    const result = await this.classifier.predictClass(activation);

    this.stateOutput.setRaw(
      `Prediction:  ${this.classes.get(
        result.label
      )}\nProbability: ${this.formatConfidence(result.confidences)}`
    );
  }

  private async loadExamples() {
    const examples = [];

    this.stateOutput.append("Loading examples...");

    for (let classId = 0; classId < catagories.children.length; classId++) {
      const thisClass = catagories.children[classId];

      if (!thisClass.children || thisClass.name == "tests") {
        continue;
      }

      this.classes.set(classId.toString(), thisClass.name);

      for (const example of thisClass.children) {
        examples.push(this.addExample(classId, example.path));
        await sleep(10);
      }
    }

    this.stateOutput.append("Examples loaded");

    await Promise.all(examples);

    this.stateOutput.append("Examples trained");
  }

  private async addExample(classId: number, path: string) {
    const url = path.replace("../src/", "/");

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
    const activation = (await this.network).infer(tensor, true);
    this.classifier.addExample(activation, classId.toString());

    img.remove();
    tensor.dispose();
  }

  private formatConfidence(confidence: { [label: string]: number }): string {
    let out = "\n";

    for (const label in confidence) {
      out += `    ${this.classes.get(label)}: ${confidence[label]}\n`;
    }

    return out;
  }
}

const trainer = new Trainer();

const trainingButton = document.getElementById(
  "train_start"
) as HTMLButtonElement;

// Wait for the user to click the button to start training
trainingButton.addEventListener("click", async () => {
  trainingButton.disabled = true;
  trainingButton.innerText =
    "Training in progress. Please leave this tab in the foreground for around 5 minutes";

  await trainer.start();

  trainingButton.style.display = "none";
});
