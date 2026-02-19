#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Languages to build WASM parsers for
const langs = ["java", "python", "javascript", "typescript"];

// Language-package map (when the npm package structure differs from the language name)
const langMap = {
  typescript: ["typescript", "typescript"],
  typescriptreact: ["typescript", "tsx"],
};

// Ensure parsers output directory exists
const parsersDir = path.join(__dirname, "..", "parsers");
if (!fs.existsSync(parsersDir)) {
  fs.mkdirSync(parsersDir);
}

// Build WASM parsers for each language
for (const lang of langs) {
  let modulePath = path.join("node_modules", "tree-sitter-" + lang);
  let outputName = "tree-sitter-" + lang + ".wasm";

  if (langMap[lang]) {
    modulePath = path.join(
      "node_modules",
      "tree-sitter-" + langMap[lang][0],
      ...langMap[lang].slice(1),
    );
    outputName =
      "tree-sitter-" + langMap[lang][langMap[lang].length - 1] + ".wasm";
  }

  const destPath = path.join(parsersDir, lang + ".wasm");

  console.log(`Building WASM parser for ${lang}...`);

  try {
    // tree-sitter-cli >= 0.21: "build --wasm" replaces "build-wasm"
    // wasi-sdk is auto-downloaded if not present (no Emscripten needed)
    execSync(
      `node_modules/.bin/tree-sitter build --wasm ${modulePath} -o ${outputName}`,
      {
        stdio: "inherit",
      },
    );

    // Move the built .wasm file to parsers/ directory
    if (fs.existsSync(outputName)) {
      fs.renameSync(outputName, destPath);
      console.log(`  ✓ ${lang} parser → ${destPath}`);
    } else {
      console.error(`  ✗ ${lang}: expected output ${outputName} not found`);
    }
  } catch (err) {
    console.error(`  ✗ Failed to build ${lang} parser: ${err.message}`);
    process.exitCode = 1;
  }
}
