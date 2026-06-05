#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Node, Project, SyntaxKind } from "ts-morph";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(scriptDir, "..");
const srcDir = resolve(frontendDir, "src");
const tsconfigPath = resolve(frontendDir, "tsconfig.app.json");
const allowlistPath = resolve(scriptDir, "fsd-import-boundary-allowlist.json");

const LAYER_ORDER = new Map([
  ["shared", 0],
  ["entities", 1],
  ["features", 2],
  ["widgets", 3],
  ["pages", 4],
  ["app", 5],
]);
const CROSS_SLICE_LAYERS = new Set([
  "pages",
  "widgets",
  "features",
  "entities",
]);
const REQUIRED_ALLOWLIST_FIELDS = ["reason"];
const IGNORED_FILE_PATTERNS = [
  /\/src\/shared\/api\/generated\//,
  /\/src\/test\//,
  /\.d\.ts$/,
  /\.test\.[cm]?[tj]sx?$/,
  /\.spec\.[cm]?[tj]sx?$/,
  /\.integration\.[cm]?[tj]sx?$/,
];

function loadAllowlist() {
  const raw = JSON.parse(readFileSync(allowlistPath, "utf8"));
  if (!Array.isArray(raw.entries)) {
    throw new Error(
      "fsd-import-boundary-allowlist.json must contain an entries array.",
    );
  }
  return raw.entries;
}

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function isIgnoredFile(filePath) {
  const normalized = normalizePath(filePath);
  return IGNORED_FILE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function classifySrcPath(filePath) {
  const srcRelative = normalizePath(relative(srcDir, filePath));
  if (srcRelative.startsWith("../")) {
    return null;
  }

  const [layer, slice = null] = srcRelative.split("/");
  if (!LAYER_ORDER.has(layer)) {
    return null;
  }

  return {
    layer,
    slice,
  };
}

function resolveImportPath(sourceFile, moduleSpecifier) {
  if (moduleSpecifier.startsWith("@/")) {
    return resolve(srcDir, moduleSpecifier.slice(2));
  }

  if (moduleSpecifier.startsWith(".")) {
    return resolve(dirname(sourceFile.getFilePath()), moduleSpecifier);
  }

  return null;
}

function isSourceImport(moduleSpecifier) {
  return moduleSpecifier.startsWith("@/") || moduleSpecifier.startsWith(".");
}

function collectModuleReferences(sourceFile) {
  const references = [];

  for (const declaration of sourceFile.getImportDeclarations()) {
    references.push({
      line: declaration.getStartLineNumber(),
      moduleSpecifier: declaration.getModuleSpecifierValue(),
    });
  }

  for (const declaration of sourceFile.getExportDeclarations()) {
    const moduleSpecifier = declaration.getModuleSpecifierValue();
    if (moduleSpecifier) {
      references.push({
        line: declaration.getStartLineNumber(),
        moduleSpecifier,
      });
    }
  }

  sourceFile.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) {
      return;
    }

    if (node.getExpression().getKind() !== SyntaxKind.ImportKeyword) {
      return;
    }

    const [firstArgument] = node.getArguments();
    if (
      !Node.isStringLiteral(firstArgument) &&
      !Node.isNoSubstitutionTemplateLiteral(firstArgument)
    ) {
      return;
    }

    references.push({
      line: node.getStartLineNumber(),
      moduleSpecifier: firstArgument.getLiteralText(),
    });
  });

  return references;
}

function violationReason(source, target) {
  const sourceRank = LAYER_ORDER.get(source.layer);
  const targetRank = LAYER_ORDER.get(target.layer);

  if (sourceRank < targetRank) {
    return `lower layer "${source.layer}" cannot import upper layer "${target.layer}"`;
  }

  if (
    source.layer === target.layer &&
    CROSS_SLICE_LAYERS.has(source.layer) &&
    source.slice &&
    target.slice &&
    source.slice !== target.slice
  ) {
    return `cross-slice import is not allowed inside "${source.layer}" (${source.slice} -> ${target.slice})`;
  }

  return null;
}

function collectViolations() {
  const project = new Project({
    tsConfigFilePath: tsconfigPath,
    skipAddingFilesFromTsConfig: true,
  });
  project.addSourceFilesAtPaths(resolve(srcDir, "**/*.{ts,tsx}"));

  const violations = [];

  for (const sourceFile of project.getSourceFiles()) {
    const sourceFilePath = sourceFile.getFilePath();
    if (isIgnoredFile(sourceFilePath)) {
      continue;
    }

    const source = classifySrcPath(sourceFilePath);
    if (!source) {
      continue;
    }

    const file = normalizePath(relative(frontendDir, sourceFilePath));

    for (const reference of collectModuleReferences(sourceFile)) {
      if (!isSourceImport(reference.moduleSpecifier)) {
        continue;
      }

      const targetPath = resolveImportPath(
        sourceFile,
        reference.moduleSpecifier,
      );
      if (!targetPath) {
        continue;
      }

      const target = classifySrcPath(targetPath);
      if (!target) {
        continue;
      }

      const reason = violationReason(source, target);
      if (!reason) {
        continue;
      }

      violations.push({
        file,
        line: reference.line,
        importPath: reference.moduleSpecifier,
        reason,
      });
    }
  }

  return violations.sort((left, right) => {
    const fileOrder = left.file.localeCompare(right.file);
    return fileOrder === 0 ? left.line - right.line : fileOrder;
  });
}

function violationKey(violation) {
  return [violation.file, violation.importPath, violation.reason].join(
    "\u0000",
  );
}

function displayViolation(violation) {
  return `${violation.file}:${violation.line ?? "?"} imports "${violation.importPath}" - ${violation.reason}`;
}

function validateAllowlistEntry(entry, index) {
  const prefix = `allowlist entry #${index + 1}`;
  for (const field of ["file", "importPath"]) {
    if (typeof entry[field] !== "string" || entry[field].length === 0) {
      throw new Error(`${prefix} is missing required string field "${field}".`);
    }
  }

  for (const field of REQUIRED_ALLOWLIST_FIELDS) {
    if (typeof entry[field] !== "string" || entry[field].trim().length === 0) {
      throw new Error(`${prefix} must explain "${field}".`);
    }
  }
}

function main() {
  const allowlist = loadAllowlist();
  allowlist.forEach(validateAllowlistEntry);

  const violations = collectViolations();
  const allowlistKeys = new Set();
  const matchedAllowlistIndexes = new Set();

  for (const [index, entry] of allowlist.entries()) {
    const matches = violations.filter(
      (violation) =>
        violation.file === entry.file &&
        violation.importPath === entry.importPath &&
        (!entry.reasonMatch || violation.reason.includes(entry.reasonMatch)),
    );

    if (matches.length > 0) {
      matchedAllowlistIndexes.add(index);
    }

    for (const match of matches) {
      allowlistKeys.add(violationKey(match));
    }
  }

  const unapproved = violations.filter(
    (violation) => !allowlistKeys.has(violationKey(violation)),
  );
  const staleEntries = allowlist.filter(
    (_, index) => !matchedAllowlistIndexes.has(index),
  );

  if (unapproved.length === 0 && staleEntries.length === 0) {
    console.log(
      `FSD import boundary audit passed (${violations.length} allowlisted violation${violations.length === 1 ? "" : "s"}).`,
    );
    return;
  }

  if (unapproved.length > 0) {
    console.error("FSD import boundary violations found:");
    for (const violation of unapproved) {
      console.error(`- ${displayViolation(violation)}`);
    }
    console.error(
      "\nFix the import direction/slice boundary, or add a justified entry to scripts/fsd-import-boundary-allowlist.json.",
    );
  }

  if (staleEntries.length > 0) {
    console.error("Stale FSD boundary allowlist entries found:");
    for (const entry of staleEntries) {
      console.error(`- ${entry.file} imports "${entry.importPath}"`);
    }
    console.error("\nRemove stale allowlist entries before merging.");
  }

  process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
