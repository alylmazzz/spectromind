import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "@babel/parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, "..", "Spectromasterv0.2tester.html"), "utf8");
const m = html.match(/<script\s+type=["']text\/babel["'][^>]*>([\s\S]*?)<\/script>/i);
const ast = parse(m[1], { sourceType: "module", plugins: ["jsx"] });
const body = ast.program.body;
for (let idx = 48; idx <= 65; idx++) {
  const n = body[idx];
  if (!n) continue;
  const name =
    n.type === "FunctionDeclaration"
      ? n.id?.name
      : n.type === "VariableDeclaration"
        ? n.declarations?.map((d) => d.id?.name).filter(Boolean).join(",")
        : n.type === "ClassDeclaration"
          ? n.id?.name
          : "";
  console.log(idx, n.type, name);
}
