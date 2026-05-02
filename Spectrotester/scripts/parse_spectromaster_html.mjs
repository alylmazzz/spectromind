import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "@babel/parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "..", "Spectromasterv0.2tester.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script\s+type=["']text\/babel["'][^>]*>([\s\S]*?)<\/script>/i);
if (!m) {
  console.error("No text/babel script found");
  process.exit(1);
}
const code = m[1];
try {
  parse(code, { sourceType: "module", plugins: ["jsx"] });
  console.log("PARSE_OK");
} catch (e) {
  console.error(e.message);
  if (e.loc) {
    const lines = code.split("\n");
    const L = e.loc.line;
    console.error("totalLines", lines.length, "errorLine", L, "col", e.loc.column);
    for (let i = Math.max(0, L - 6); i < Math.min(lines.length, L + 6); i++) {
      const mark = i + 1 === L ? ">>>" : "   ";
      console.log(mark + String(i + 1) + "|" + JSON.stringify(lines[i]));
    }
  }
  process.exit(1);
}
