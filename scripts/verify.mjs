import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const webPackagePath = resolve(root, "apps/web/package.json");

const results = [];

function run(name, command, options = {}) {
  console.log("\n==================================================");
  console.log(`DANTOWN VERIFY: ${name}`);
  console.log("==================================================");
  console.log(`> ${command}\n`);

  try {
    execSync(command, {
      cwd: root,
      stdio: "inherit",
      shell: true,
      ...options,
    });

    results.push({ name, status: "PASS" });
    console.log(`\n✓ ${name} PASSED`);
    return true;
  } catch {
    results.push({ name, status: "FAIL" });
    console.error(`\n✗ ${name} FAILED`);
    return false;
  }
}

function hasWebScript(scriptName) {
  if (!existsSync(webPackagePath)) return false;

  try {
    const pkg = JSON.parse(readFileSync(webPackagePath, "utf8"));
    return Boolean(pkg.scripts?.[scriptName]);
  } catch {
    return false;
  }
}

let failed = false;

// --------------------------------------------------
// 1. Git whitespace / patch validation
// --------------------------------------------------

if (
  !run(
    "Git diff validation",
    "git diff --check"
  )
) {
  failed = true;
}

// --------------------------------------------------
// 2. Check accidentally tracked/untracked sensitive files
// --------------------------------------------------

console.log("\n==================================================");
console.log("DANTOWN VERIFY: Sensitive file check");
console.log("==================================================");

try {
  const output = execSync("git status --short", {
    cwd: root,
    encoding: "utf8",
    shell: true,
  });

  const suspicious = output
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => {
      const paths = line.slice(3).split(" -> ").map((path) => path.trim().replaceAll("\\", "/").replace(/^"|"$/g, ""));

      return paths.some((path) =>
        /(^|\/)\.env(?:\.(?!example$)[^/]+)?$/i.test(path) ||
        /(^|\/)(node_modules|\.next)(\/|$)/i.test(path)
      );
    });

  if (suspicious.length > 0) {
    console.error("\n✗ Potentially sensitive/generated files detected:");
    suspicious.forEach((line) => console.error(`  ${line}`));
    console.error(
      "\nDo not commit environment files, node_modules, or .next output."
    );
    results.push({ name: "Sensitive file check", status: "FAIL" });
    failed = true;
  } else {
    console.log("✓ No forbidden files detected.");
    results.push({ name: "Sensitive file check", status: "PASS" });
  }
} catch {
  results.push({ name: "Sensitive file check", status: "FAIL" });
  failed = true;
}

// --------------------------------------------------
// 3. TypeScript
// --------------------------------------------------

if (hasWebScript("typecheck")) {
  if (
    !run(
      "TypeScript",
      "npm run --workspace @dantown/web typecheck"
    )
  ) {
    failed = true;
  }
} else {
  console.log("\nℹ No web typecheck script found; Next.js build will still validate TypeScript.");
  results.push({ name: "TypeScript", status: "SKIPPED" });
}

// --------------------------------------------------
// 4. ESLint
// --------------------------------------------------

if (hasWebScript("lint")) {
  if (
    !run(
      "ESLint",
      "npm run --workspace @dantown/web lint"
    )
  ) {
    failed = true;
  }
} else {
  console.log("\nℹ No web lint script found.");
  results.push({ name: "ESLint", status: "SKIPPED" });
}

// --------------------------------------------------
// 5. Tests
// --------------------------------------------------

if (hasWebScript("test")) {
  if (
    !run(
      "Tests",
      "npm run --workspace @dantown/web test"
    )
  ) {
    failed = true;
  }
} else {
  console.log("\nℹ No web test script found.");
  results.push({ name: "Tests", status: "SKIPPED" });
}

// --------------------------------------------------
// 6. Production build — MANDATORY
// --------------------------------------------------

if (!run("Production build", "npm run build")) {
  failed = true;
}

// --------------------------------------------------
// FINAL REPORT
// --------------------------------------------------

console.log("\n\n==================================================");
console.log("        DANTOWN DEPLOYMENT VERIFICATION");
console.log("==================================================\n");

for (const result of results) {
  const symbol =
    result.status === "PASS"
      ? "✓"
      : result.status === "FAIL"
        ? "✗"
        : "○";

  console.log(`${symbol} ${result.name}: ${result.status}`);
}

console.log("\n==================================================");

if (failed) {
  console.error("DANTOWN DEPLOYMENT BLOCKED");
  console.error("Fix every failed check before pushing.");
  console.error("==================================================\n");
  process.exit(1);
}

console.log("DANTOWN DEPLOYMENT CHECKS PASSED");
console.log("Push/deployment is permitted.");
console.log("==================================================\n");

process.exit(0);
