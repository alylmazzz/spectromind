import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "@babel/parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, "..", "Spectromasterv0.2tester.html"), "utf8");
const m = html.match(/<script\s+type=["']text\/babel["'][^>]*>([\s\S]*?)<\/script>/i);
const ast = parse(m[1], { sourceType: "module", plugins: ["jsx"] });
ast.program.body.forEach((n, idx) => {
  let extra = "";
  if (n.type === "FunctionDeclaration") extra = n.id?.name || "";
  if (n.type === "ClassDeclaration") extra = n.id?.name || "";
  if (n.type === "VariableDeclaration")
    extra = n.declarations?.map((d) => d.id?.name).filter(Boolean).join(",") || "";
  console.log(idx, n.type, extra);
});
