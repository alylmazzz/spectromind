import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "@babel/parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, "..", "Spectromasterv0.2tester.html"), "utf8");
const lines = html.split(/\n/);
// HTML line numbers 1-based: generate2D starts 9320, ends at `    };` (closing const)
const slice = lines.slice(9320 - 1, 12143).join("\n");
const wrap = `${slice}\n`;
try {
  parse(wrap, { sourceType: "module", plugins: ["jsx"] });
  console.log("GENERATE2D_BLOCK_PARSE_OK");
} catch (e) {
  console.error("FAIL", e.message);
  if (e.loc) console.error("line", e.loc.line, "col", e.loc.column);
}
