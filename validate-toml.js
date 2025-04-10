const fs = require("fs");
const iarnaTOML = require("@iarna/toml");

try {
  const content = fs.readFileSync("config/tasks.toml", "utf8");
  const parsed = iarnaTOML.parse(content);
  console.log("TOML file is valid!");
  console.log("Parsed structure:", JSON.stringify(parsed, null, 2));
} catch (err) {
  console.error("Error parsing TOML:", err);
}
