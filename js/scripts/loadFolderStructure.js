const fs = require("fs");
const dirTree = require("directory-tree");
const filteredTree = dirTree("../src/public/", { extensions: /\.png/ });

fs.writeFileSync(
  "../src/public/contents.json",
  JSON.stringify(filteredTree, null, 2)
);
