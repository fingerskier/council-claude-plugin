const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

test("Codex manifest exposes the shared skill directory", () => {
  const manifest = readJson(".codex-plugin/plugin.json");

  assert.equal(manifest.name, "council-claude-plugin");
  assert.equal(manifest.version, "0.1.0");
  assert.equal(manifest.skills, "./skills/");
  assert.equal(manifest.license, "Apache-2.0");
  assert.equal(manifest.author.name, "fingerskier");
  assert.deepEqual(manifest.keywords, [
    "council",
    "deliberation",
    "multi-agent",
    "subagents",
    "orchestration",
  ]);

  assert.equal(manifest.interface.displayName, "Council");
  assert.equal(manifest.interface.category, "Productivity");
  assert.ok(manifest.interface.capabilities.includes("Multi-agent"));
  assert.ok(manifest.interface.defaultPrompt.some((prompt) => prompt.startsWith("council convene")));
  assert.equal(Object.hasOwn(manifest, "mcpServers"), false);
  assert.equal(Object.hasOwn(manifest, "apps"), false);
});

test("standalone Codex plugin is exposed through the repo marketplace", () => {
  const marketplace = readJson(".agents/plugins/marketplace.json");
  const codexManifest = readJson("plugins/council-codex/.codex-plugin/plugin.json");

  assert.equal(marketplace.name, "fingerskier-council-plugins");
  assert.equal(marketplace.interface.displayName, "Fingerskier Council Plugins");
  assert.deepEqual(marketplace.plugins, [
    {
      name: "council-codex",
      source: {
        source: "local",
        path: "./plugins/council-codex",
      },
      policy: {
        installation: "AVAILABLE",
        authentication: "ON_INSTALL",
      },
      category: "Productivity",
    },
  ]);

  assert.equal(codexManifest.name, "council-codex");
  assert.equal(codexManifest.version, "0.1.0");
  assert.equal(codexManifest.skills, "../../skills/");
  assert.equal(codexManifest.license, "Apache-2.0");
  assert.equal(codexManifest.author.name, "fingerskier");
  assert.equal(codexManifest.interface.displayName, "Council for Codex");
  assert.equal(codexManifest.interface.category, "Productivity");
  assert.ok(codexManifest.interface.capabilities.includes("Multi-agent"));
  assert.equal(Object.hasOwn(codexManifest, "hooks"), false);
  assert.equal(Object.hasOwn(codexManifest, "mcpServers"), false);
  assert.equal(Object.hasOwn(codexManifest, "apps"), false);
});

test("Claude and Codex entrypoints delegate to the same orchestrator", () => {
  const claudeManifest = readJson(".claude-plugin/plugin.json");
  const command = readText("commands/council.md");
  const skill = readText("skills/council-orchestrator/SKILL.md");

  assert.equal(claudeManifest.name, "council");
  assert.match(command, /follow the `council-orchestrator` skill/);
  assert.match(command, /\$\{CLAUDE_PLUGIN_ROOT\}` as `COUNCIL_PLUGIN_ROOT`/);

  assert.match(skill, /name: council-orchestrator/);
  assert.match(skill, /## Host adapter/);
  assert.match(skill, /COUNCIL_PLUGIN_ROOT\/templates/);
  assert.match(skill, /COUNCIL_PLUGIN_ROOT\/personalities/);
  assert.match(skill, /Claude `Task` tool/);
  assert.match(skill, /multi_agent_v1\.spawn_agent/);
  assert.doesNotMatch(skill, /\$\{CLAUDE_PLUGIN_ROOT\}\/templates/);
  assert.doesNotMatch(skill, /\$\{CLAUDE_PLUGIN_ROOT\}\/personalities/);
});

test("templates reference bundled personality files", () => {
  const templateDir = path.join(repoRoot, "templates");
  const personalityDir = path.join(repoRoot, "personalities");
  const templateFiles = fs.readdirSync(templateDir).filter((file) => file.endsWith(".yaml"));

  assert.ok(templateFiles.length > 0, "expected bundled templates");

  for (const file of templateFiles) {
    const contents = fs.readFileSync(path.join(templateDir, file), "utf8");
    const seatsLine = contents.match(/^seats:\s*\[(?<seats>[^\]]+)\]/m);
    assert.ok(seatsLine, `${file} must define seats as an inline list`);

    const seats = seatsLine.groups.seats.split(",").map((seat) => seat.trim());
    assert.ok(seats.length > 0, `${file} must include at least one seat`);

    for (const seat of seats) {
      assert.ok(
        fs.existsSync(path.join(personalityDir, `${seat}.md`)),
        `${file} references missing personality ${seat}`,
      );
    }
  }
});
