import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "@babel/parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(__dirname, "..", "_tmp_babel.jsx"), "utf8");

for (let n = 1; n <= 15; n++) {
  const probe = code + "\n" + "}".repeat(n) + "\n";
  try {
    parse(probe, { sourceType: "module", plugins: ["jsx"] });
    console.log("PARSE_OK with", n, "extra } at EOF");
    process.exit(0);
  } catch (e) {
    console.log(n, e.message.split("\n")[0]);
  }
}
console.log("no fix with 1-15 extra braces");
