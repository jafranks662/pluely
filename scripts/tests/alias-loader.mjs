import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = process.cwd();
const distRoot = path.join(projectRoot, "dist-tests", "src");

export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith("@/")) {
    const relativePath = specifier.slice(2);
    const directPath = path.join(distRoot, relativePath);
    const jsPath = `${directPath}.js`;
    const indexPath = path.join(directPath, "index.js");

    if (fs.existsSync(jsPath)) {
      return { url: pathToFileURL(jsPath).href, shortCircuit: true };
    }

    if (fs.existsSync(indexPath)) {
      return { url: pathToFileURL(indexPath).href, shortCircuit: true };
    }
  }

  if (specifier.startsWith(".") && context.parentURL) {
    const parentPath = new URL(context.parentURL);
    const basePath = path.dirname(parentPath.pathname);
    const resolvedPath = path.join(basePath, specifier);
    const jsPath = `${resolvedPath}.js`;
    const indexPath = path.join(resolvedPath, "index.js");

    if (fs.existsSync(jsPath)) {
      return { url: pathToFileURL(jsPath).href, shortCircuit: true };
    }

    if (fs.existsSync(indexPath)) {
      return { url: pathToFileURL(indexPath).href, shortCircuit: true };
    }
  }

  return defaultResolve(specifier, context, defaultResolve);
}
