#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Node, Project } from "ts-morph";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(scriptDir, "..");
const tsconfigPath = resolve(frontendDir, "tsconfig.app.json");
const allowlistPath = resolve(scriptDir, "manual-api-call-allowlist.json");

const MANUAL_API_IMPORTS = new Set(["apiClient", "customFetch"]);
const REQUIRED_ALLOWLIST_FIELDS = ["reason", "scope", "wrapperPurpose"];
const IGNORED_FILE_PATTERNS = [
  /\/src\/shared\/api\/generated\//,
  /\/src\/shared\/api\/index\.ts$/,
  /\/src\/shared\/api\/mutator\.ts$/,
  /\/src\/test\//,
  /\.test\.[cm]?[tj]sx?$/,
  /\.spec\.[cm]?[tj]sx?$/,
];

function loadAllowlist() {
  const raw = JSON.parse(readFileSync(allowlistPath, "utf8"));
  if (!Array.isArray(raw.entries)) {
    throw new Error(
      "manual-api-call-allowlist.json must contain an entries array.",
    );
  }
  return raw.entries;
}

function isManualApiImportModule(moduleSpecifier) {
  return (
    moduleSpecifier === "@/shared/api" ||
    moduleSpecifier === "@/shared/api/mutator" ||
    moduleSpecifier.endsWith("/shared/api") ||
    moduleSpecifier.endsWith("/shared/api/mutator")
  );
}

function isIgnoredFile(filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  return IGNORED_FILE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function endpointFingerprint(argument) {
  if (!argument) {
    return "<missing>";
  }

  if (
    Node.isStringLiteral(argument) ||
    Node.isNoSubstitutionTemplateLiteral(argument)
  ) {
    return argument.getLiteralText();
  }

  if (Node.isTemplateExpression(argument)) {
    return argument
      .getTemplateSpans()
      .reduce(
        (text, span) => `${text}\${}${span.getLiteral().getLiteralText()}`,
        argument.getHead().getLiteralText(),
      );
  }

  if (Node.isIdentifier(argument)) {
    return `identifier:${argument.getText()}`;
  }

  return `<${argument.getKindName()}:${argument.getText().replace(/\s+/g, " ").slice(0, 120)}>`;
}

function httpMethodFromCustomFetch(callExpression) {
  const options = callExpression.getArguments()[1];
  if (!Node.isObjectLiteralExpression(options)) {
    return "UNKNOWN";
  }

  const methodProperty = options.getProperty("method");
  if (!Node.isPropertyAssignment(methodProperty)) {
    return "UNKNOWN";
  }

  const initializer = methodProperty.getInitializer();
  if (!initializer) {
    return "UNKNOWN";
  }

  if (
    Node.isStringLiteral(initializer) ||
    Node.isNoSubstitutionTemplateLiteral(initializer)
  ) {
    return initializer.getLiteralText().toUpperCase();
  }

  return initializer.getText();
}

function collectManualApiBindings(sourceFile) {
  const bindings = new Map();

  for (const declaration of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = declaration.getModuleSpecifierValue();
    if (!isManualApiImportModule(moduleSpecifier)) {
      continue;
    }

    for (const namedImport of declaration.getNamedImports()) {
      const importedName = namedImport.getName();
      if (!MANUAL_API_IMPORTS.has(importedName)) {
        continue;
      }

      bindings.set(
        namedImport.getAliasNode()?.getText() ?? importedName,
        importedName,
      );
    }
  }

  return bindings;
}

function collectOccurrences() {
  const project = new Project({
    tsConfigFilePath: tsconfigPath,
    skipAddingFilesFromTsConfig: true,
  });
  project.addSourceFilesAtPaths(resolve(frontendDir, "src/**/*.{ts,tsx}"));

  const occurrences = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    if (isIgnoredFile(filePath)) {
      continue;
    }

    const bindings = collectManualApiBindings(sourceFile);
    if (bindings.size === 0) {
      continue;
    }

    const file = relative(frontendDir, filePath);

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      const expression = node.getExpression();
      const firstArgument = node.getArguments()[0];

      if (
        Node.isIdentifier(expression) &&
        bindings.get(expression.getText()) === "customFetch"
      ) {
        occurrences.push({
          file,
          importName: "customFetch",
          callee: "customFetch",
          endpoint: endpointFingerprint(firstArgument),
          httpMethod: httpMethodFromCustomFetch(node),
          line: node.getStartLineNumber(),
        });
        return;
      }

      if (!Node.isPropertyAccessExpression(expression)) {
        return;
      }

      const receiver = expression.getExpression();
      if (
        !Node.isIdentifier(receiver) ||
        bindings.get(receiver.getText()) !== "apiClient"
      ) {
        return;
      }

      const method = expression.getName();
      occurrences.push({
        file,
        importName: "apiClient",
        callee: `apiClient.${method}`,
        endpoint: endpointFingerprint(firstArgument),
        httpMethod: method.toUpperCase(),
        line: node.getStartLineNumber(),
      });
    });
  }

  return occurrences.sort((left, right) => {
    const fileOrder = left.file.localeCompare(right.file);
    return fileOrder === 0 ? left.line - right.line : fileOrder;
  });
}

function occurrenceKey(occurrence) {
  return [
    occurrence.file,
    occurrence.importName,
    occurrence.callee,
    occurrence.endpoint,
  ].join("\u0000");
}

function displayOccurrence(occurrence) {
  return `${occurrence.file}:${occurrence.line ?? "?"} ${occurrence.callee} ${occurrence.httpMethod} ${occurrence.endpoint}`;
}

function validateAllowlistEntry(entry, index) {
  const prefix = `allowlist entry #${index + 1}`;
  for (const field of ["file", "importName", "callee", "endpoint"]) {
    if (typeof entry[field] !== "string" || entry[field].length === 0) {
      throw new Error(`${prefix} is missing required string field "${field}".`);
    }
  }

  for (const field of REQUIRED_ALLOWLIST_FIELDS) {
    if (typeof entry[field] !== "string" || entry[field].trim().length === 0) {
      throw new Error(
        `${prefix} is missing required exception metadata "${field}".`,
      );
    }
  }

  if (
    entry.occurrences !== undefined &&
    (!Number.isInteger(entry.occurrences) || entry.occurrences < 1)
  ) {
    throw new Error(`${prefix} occurrences must be a positive integer.`);
  }
}

function summarizeByKey(items, keySelector) {
  return items.reduce((map, item) => {
    const key = keySelector(item);
    const previous = map.get(key);
    if (previous) {
      previous.count += item.occurrences ?? 1;
      previous.items.push(item);
    } else {
      map.set(key, { count: item.occurrences ?? 1, items: [item] });
    }
    return map;
  }, new Map());
}

function main() {
  const allowlist = loadAllowlist();
  allowlist.forEach(validateAllowlistEntry);

  const occurrences = collectOccurrences();
  const occurrenceCounts = summarizeByKey(occurrences, occurrenceKey);
  const allowlistCounts = summarizeByKey(allowlist, occurrenceKey);

  const unexpected = [];
  for (const [key, occurrenceSummary] of occurrenceCounts) {
    const allowlistSummary = allowlistCounts.get(key);
    if (
      !allowlistSummary ||
      allowlistSummary.count !== occurrenceSummary.count
    ) {
      unexpected.push(...occurrenceSummary.items);
    }
  }

  const stale = [];
  for (const [key, allowlistSummary] of allowlistCounts) {
    const occurrenceSummary = occurrenceCounts.get(key);
    if (
      !occurrenceSummary ||
      occurrenceSummary.count !== allowlistSummary.count
    ) {
      stale.push(...allowlistSummary.items);
    }
  }

  if (unexpected.length > 0 || stale.length > 0) {
    console.error("Manual frontend API call audit failed.");
    if (unexpected.length > 0) {
      console.error("\nUnlisted or count-changed call sites:");
      for (const occurrence of unexpected) {
        console.error(`- ${displayOccurrence(occurrence)}`);
      }
    }

    if (stale.length > 0) {
      console.error("\nUnused or count-mismatched allowlist entries:");
      for (const entry of stale) {
        console.error(
          `- ${entry.file} ${entry.callee} ${entry.endpoint} (occurrences: ${entry.occurrences ?? 1})`,
        );
      }
    }

    console.error(
      "\nUse generated endpoints by default. If a manual call is still required, update scripts/manual-api-call-allowlist.json with a reason, scope, and wrapperPurpose.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Manual frontend API call audit passed (${occurrences.length} call sites).`,
  );
}

main();
