import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "..", "Spectromasterv0.2tester.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script\s+type=["']text\/babel["'][^>]*>([\s\S]*?)<\/script>/i);
if (!m) {
  console.error("No babel script");
  process.exit(1);
}
const code = m[1];
const lines = code.split(/\n/);
let depth = 0;
for (let li = 0; li < lines.length; li++) {
  const line = lines[li];
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "/" && line[i + 1] === "/") break;
    if (ch === "/" && line[i + 1] === "*") {
      i += 2;
      while (i < line.length - 1 && !(line[i] === "*" && line[i + 1] === "/")) i++;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      const q = ch;
      i++;
      while (i < line.length) {
        if (line[i] === "\\") {
          i += 2;
          continue;
        }
        if (line[i] === q) break;
        i++;
      }
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
  }
  const n = li + 1;
  if (n === 1 || n === 5000 || n === 10000 || n === 15000 || n === 20000 || n === 21000 || n === 21500 || n === 21800 || n === 21900 || n === 22000 || n === lines.length) {
    console.log("line", n, "braceDepth", depth);
  }
}
console.log("FINAL lines", lines.length, "braceDepth", depth);
