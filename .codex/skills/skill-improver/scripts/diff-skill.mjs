#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = { skillDir: "", feedbackFile: "", writeFile: "" };
  const rest = [];

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--write") {
      args.writeFile = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    rest.push(value);
  }

  args.skillDir = rest[0] ?? "";
  args.feedbackFile = rest[1] ?? "";
  return args;
}

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function extractHeadings(markdown) {
  const headings = [];
  const regex = /^(#{1,6})\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    headings.push({
      level: match[1].length,
      title: match[2].trim()
    });
  }
  return headings;
}

function extractSecondLevelSections(markdown) {
  const matches = [...markdown.matchAll(/^##\s+(.+)$/gm)];
  if (matches.length === 0) {
    return [];
  }

  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? markdown.length) : markdown.length;
    return {
      title: match[1].trim(),
      body: markdown.slice(start, end).trim()
    };
  });
}

function tokenize(value) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[`*_#()[\]{}:,.!?/\\|-]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 3)
  );
}

function scoreByOverlap(target, sourceTokens) {
  const targetTokens = tokenize(target);
  let score = 0;
  for (const token of sourceTokens) {
    if (targetTokens.has(token)) {
      score += 1;
    }
  }
  return score;
}

function topMatches(items, sourceTokens, valueGetter, minScore = 1, limit = 3) {
  return items
    .map((item) => ({
      item,
      score: scoreByOverlap(valueGetter(item), sourceTokens)
    }))
    .filter((entry) => entry.score >= minScore)
    .sort((left, right) => right.score - left.score || valueGetter(left.item).localeCompare(valueGetter(right.item)))
    .slice(0, limit)
    .map((entry) => entry.item);
}

function listReferenceFiles(skillDir) {
  const candidates = [];
  for (const subdir of ["references", "examples"]) {
    const fullDir = path.join(skillDir, subdir);
    if (!fs.existsSync(fullDir)) {
      continue;
    }
    for (const entry of fs.readdirSync(fullDir, { withFileTypes: true })) {
      if (entry.isFile()) {
        candidates.push(path.join(subdir, entry.name));
      }
    }
  }
  return candidates;
}

function buildReport(skillDir, feedbackText) {
  const skillName = path.basename(skillDir);
  const skillPath = path.join(skillDir, "SKILL.md");
  const badPath = path.join(skillDir, "examples", "bad-outputs.md");
  const goodPath = path.join(skillDir, "examples", "good-outputs.md");

  const skillMarkdown = readIfExists(skillPath);
  const badMarkdown = readIfExists(badPath);
  const goodMarkdown = readIfExists(goodPath);

  if (!skillMarkdown) {
    throw new Error(`Missing SKILL.md in ${skillDir}`);
  }

  const skillHeadings = extractHeadings(skillMarkdown).filter((heading) => heading.level <= 3);
  const badSections = extractSecondLevelSections(badMarkdown);
  const feedbackTokens = tokenize([feedbackText, badMarkdown].filter(Boolean).join("\n"));

  const likelyBadPatterns = badSections.length > 0
    ? topMatches(badSections, feedbackTokens, (section) => `${section.title}\n${section.body}`, 1, 3)
    : [];

  const likelySkillSections = skillHeadings.length > 0
    ? topMatches(skillHeadings, feedbackTokens, (heading) => heading.title, 1, 4)
    : [];

  const supportFiles = topMatches(
    listReferenceFiles(skillDir),
    feedbackTokens,
    (file) => file,
    1,
    4
  );

  const lines = [
    "# Targeted Skill Diff Proposal",
    "",
    `- Skill: \`${skillName}\``,
    `- Skill file: \`${path.relative(process.cwd(), skillPath).replace(/\\/g, "/")}\``,
    feedbackText ? "- Feedback source: provided" : "- Feedback source: inferred from bad outputs and current skill content",
    ""
  ];

  lines.push("## Likely failure patterns", "");
  if (likelyBadPatterns.length === 0) {
    lines.push("- No labeled bad-output sections were found. Review the current feedback manually.");
  } else {
    for (const section of likelyBadPatterns) {
      lines.push(`- \`${section.title}\``);
    }
  }

  lines.push("", "## Suggested SKILL.md edits", "");
  if (likelySkillSections.length === 0) {
    lines.push("- No strong section match was found. Start with the narrowest section that governs the failing behavior.");
  } else {
    for (const section of likelySkillSections) {
      lines.push(`- Tighten the \`${section.title}\` section with one explicit rule that would have prevented the observed failure.`);
    }
  }

  lines.push("", "## Suggested support-file updates", "");
  const defaultSupport = [];
  if (fs.existsSync(badPath)) defaultSupport.push("examples/bad-outputs.md");
  if (fs.existsSync(goodPath)) defaultSupport.push("examples/good-outputs.md");
  const supportList = supportFiles.length > 0 ? supportFiles : defaultSupport;
  if (supportList.length === 0) {
    lines.push("- No support files discovered.");
  } else {
    for (const file of supportList) {
      lines.push(`- Review \`${file.replace(/\\/g, "/")}\` for the smallest supporting update.`);
    }
  }

  lines.push(
    "",
    "## Versioning reminder",
    "",
    "- Copy `SKILL.md` to `SKILL.v{N}.md` before editing.",
    "- Add one new changelog line at the top of `SKILL.md`.",
    "- Patch only the affected section or reference unless the failure has repeated three times."
  );

  const goodSectionCount = extractSecondLevelSections(goodMarkdown).length;
  if (goodSectionCount > 0) {
    lines.push("", "## Good-output reminder", "", "- If you introduce a new preferred pattern, capture it in `examples/good-outputs.md`.");
  }

  return `${lines.join("\n")}\n`;
}

function main() {
  const { skillDir, feedbackFile, writeFile } = parseArgs(process.argv.slice(2));

  if (!skillDir) {
    console.error("Usage: node diff-skill.mjs <skillDir> [feedbackFile] [--write outputFile]");
    process.exit(1);
  }

  const resolvedSkillDir = path.resolve(skillDir);
  const feedbackText = feedbackFile ? readIfExists(path.resolve(feedbackFile)) : "";
  const report = buildReport(resolvedSkillDir, feedbackText);

  if (writeFile) {
    const resolvedWriteFile = path.resolve(writeFile);
    fs.mkdirSync(path.dirname(resolvedWriteFile), { recursive: true });
    fs.writeFileSync(resolvedWriteFile, report, "utf8");
    console.log(`Wrote targeted diff proposal to ${resolvedWriteFile}`);
    return;
  }

  process.stdout.write(report);
}

main();
