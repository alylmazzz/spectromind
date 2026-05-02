import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "@babel/parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, "..", "Spectromasterv0.2tester.html"), "utf8");
const m = html.match(/<script\s+type=["']text\/babel["'][^>]*>([\s\S]*?)<\/script>/i);
const ast = parse(m[1], { sourceType: "module", plugins: ["jsx"] });
ast.program.body.forEach((n, idx) => {
  if (n.type === "ClassDeclaration") console.log("Class", idx, n.id?.name);
  if (n.type === "FunctionDeclaration" && (n.id?.name === "App" || n.id?.name?.includes("Error"))) console.log("Fn", idx, n.id?.name);
});
