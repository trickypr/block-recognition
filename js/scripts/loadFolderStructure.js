const fs = require("fs");
const dirTree = require("directory-tree");
const filteredTree = dirTree("../public/", { extensions: /\.png/ });

fs.writeFileSync(
  "../public/contents.json",
  JSON.stringify(filteredTree, null, 2)
);
