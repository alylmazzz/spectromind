import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "@babel/parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "..", "Spectromasterv0.2tester.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script\s+type=["']text\/babel["'][^>]*>([\s\S]*?)<\/script>/i);
const full = m[1];
const lines = full.split(/\n/);

function tryParse(upToLine) {
  const chunk = lines.slice(0, upToLine).join("\n") + "\n";
  try {
    parse(chunk, { sourceType: "module", plugins: ["jsx"] });
    return null;
  } catch (e) {
    return e.message;
  }
}

let lo = 1;
let hi = lines.length;
// Find first line where prefix becomes invalid (if we add lines one by one from start)
// Actually: find smallest n such that lines[0..n] does NOT parse
let firstBad = hi;
while (lo <= hi) {
  const mid = Math.floor((lo + hi) / 2);
  const err = tryParse(mid);
  if (err) {
    firstBad = mid;
    hi = mid - 1;
  } else {
    lo = mid + 1;
  }
}
console.log("first line where prefix fails to parse:", firstBad, "total", lines.length);
if (firstBad <= lines.length) {
  const err = tryParse(firstBad);
  console.log("error:", err);
  const L = firstBad;
  for (let i = Math.max(1, L - 5); i <= Math.min(lines.length, L + 3); i++) {
    console.log(String(i) + "|" + lines[i - 1].slice(0, 200));
  }
}
