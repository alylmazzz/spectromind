import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "@babel/parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, "..", "Spectromasterv0.2tester.html"), "utf8");
const m = html.match(/<script\s+type=["']text\/babel["'][^>]*>([\s\S]*?)<\/script>/i);
const ast = parse(m[1], { sourceType: "module", plugins: ["jsx"] });

const body = ast.program.body;
console.log("program body count", body.length);
body.forEach((n, idx) => {
  if (n.type !== "FunctionDeclaration") return;
  console.log("FunctionDeclaration", idx, n.id?.name);
});
const appDecl = body.find((n) => n.type === "FunctionDeclaration" && n.id?.name === "App");
console.log("App as top-level FunctionDeclaration:", !!appDecl);
const appVar = body.find(
  (n) =>
    n.type === "VariableDeclaration" &&
    n.declarations?.some((d) => d.id?.name === "App")
);
console.log("App as VariableDeclaration:", !!appVar);
body.slice(-8).forEach((n, i) => {
  const idx = body.length - 8 + i;
  const name =
    n.type === "FunctionDeclaration"
      ? n.id?.name
      : n.type === "VariableDeclaration"
        ? n.declarations?.map((d) => d.id?.name).filter(Boolean).join(",")
        : "";
  console.log("tail", idx, n.type, name);
});
