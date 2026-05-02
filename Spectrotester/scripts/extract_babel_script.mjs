import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "..", "Spectromasterv0.2tester.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script\s+type=["']text\/babel["'][^>]*>([\s\S]*?)<\/script>/i);
if (!m) throw new Error("no script");
const out = path.join(__dirname, "..", "_tmp_babel.jsx");
fs.writeFileSync(out, m[1], "utf8");
console.log("wrote", out, "bytes", m[1].length);
