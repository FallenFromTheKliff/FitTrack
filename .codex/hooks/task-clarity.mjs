#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const MAX_CONTEXT_CHARS = 1200;

const EXPLICIT_BUG_PATTERN =
  /\b(bug|broken|breaks|error|fails?|failure|regression|incorrect|wrong|fix|doesn['’]?t work|not working)\b/i;
const READ_ONLY_PATTERN =
  /\b(review|inspect|investigate|explain|diagnose|report|list|check|audit|query|what is|how does|read[- ]?only|no changes?|without changes?)\b/i;
const CURRENT_PATTERN = /\b(current|latest|today|now|verify|confirm|version|status)\b/i;
const REFERENCE_PATTERN =
  /\b(1\s*:\s*1|pixel[- ]?perfect|match (?:the )?(?:reference|screenshot|golden)|baseline|golden|figma|visual diff)\b/i;
const VAGUE_FEATURE_PATTERN =
  /\b(add|build|create|design|implement|improve|feature|screen|page|flow|make)\b/i;
const HARD_AUTHORITY_ACTION_PATTERN =
  /\b(delete|remove|purge|drop|reset|destroy|deploy|publish|release|alter|truncate|migrate|migration|rotate|revoke)\b/i;
const PAYMENT_AUTHORITY_PATTERN =
  /\b(?:process|capture|charge|refund|settle|authorize|authorization|void|payout|transfer|collect|approve|configure|set|change|update|modify)\b[\s\S]{0,80}\b(?:payment|payments|checkout|billing|refund|charge|payout)\b|\b(?:payment|payments|checkout|billing|refund|charge|payout)\b[\s\S]{0,80}\b(?:process|capture|charge|refund|settle|authorize|authorization|void|payout|transfer|collect|approve|configure|set|change|update|modify)\b/i;
const CREDENTIAL_AUTHORITY_PATTERN =
  /\b(?:rotate|revoke|share|provide|store|set|change|update|expose)\b[\s\S]{0,80}\b(?:credential|secret|token|api key|password)\b|\b(?:credential|secret|token|api key|password)\b[\s\S]{0,80}\b(?:rotate|revoke|share|provide|store|set|change|update|expose)\b/i;
const AUTHORITY_DOMAIN_PATTERN =
  /\b(production|prod|database|db|migration|migrate|credential|secret|payment|payments)\b/i;

function requiresAuthority(value) {
  if (HARD_AUTHORITY_ACTION_PATTERN.test(value)) return true;

  // A clear bug or read-only request wins over a sensitive subject. Payment,
  // database, and credential words alone do not authorize an action.
  if (
    EXPLICIT_BUG_PATTERN.test(value) ||
    READ_ONLY_PATTERN.test(value) ||
    CURRENT_PATTERN.test(value) ||
    REFERENCE_PATTERN.test(value) ||
    VAGUE_FEATURE_PATTERN.test(value)
  ) {
    return false;
  }

  return (
    PAYMENT_AUTHORITY_PATTERN.test(value) ||
    CREDENTIAL_AUTHORITY_PATTERN.test(value) ||
    AUTHORITY_DOMAIN_PATTERN.test(value)
  );
}

export function promptFromEvent(event) {
  if (typeof event === "string") return event;
  if (!event || typeof event !== "object") return "";
  for (const key of ["prompt", "user_prompt", "userPrompt", "message", "input"]) {
    if (typeof event[key] === "string") return event[key];
  }
  return "";
}

export function classifyPrompt(prompt) {
  const value = String(prompt ?? "").replace(/\s+/g, " ").trim();
  if (!value) return "clear-simple";
  if (requiresAuthority(value)) return "authority-sensitive";
  if (EXPLICIT_BUG_PATTERN.test(value)) return "explicit-bug";
  if (READ_ONLY_PATTERN.test(value)) return "read-only";
  if (CURRENT_PATTERN.test(value)) return "current-verification";
  if (REFERENCE_PATTERN.test(value)) return "reference-1to1";
  if (VAGUE_FEATURE_PATTERN.test(value)) return "vague-feature-design";
  return "clear-simple";
}

function isClearSimple(prompt, kind) {
  if (kind === "explicit-bug") {
    return /(?:[A-Za-z]:\\|\/|\.tsx?|\.jsx?|\.css|component|button|route|screen|page)/i.test(prompt);
  }
  return kind === "read-only" && prompt.length <= 180;
}

export function buildContext(prompt) {
  const kind = classifyPrompt(prompt);
  if (!prompt || isClearSimple(prompt, kind)) return "";

  const route = {
    "vague-feature-design": "Route vague feature/design requests through a compact brainstorm before implementation.",
    "explicit-bug": "Treat this as an explicit bug: skip brainstorm and trace the smallest owning surface.",
    "reference-1to1": "Treat the named reference or 1:1 correction as authoritative; preserve behavior and verify the exact surface.",
    "read-only": "Keep this read-only unless the user explicitly authorizes a change.",
    "current-verification": "Verify current/latest claims against runtime or official documentation before stating them.",
    "authority-sensitive": "Ask one question only if the material authority or target remains undiscoverable from the request and repo.",
  }[kind] ?? "Keep the request bounded to the stated outcome.";

  const context = [
    `Task clarity: ${kind}.`,
    route,
    "Evidence order: user request > repo > runtime/tests > official docs > labelled inference.",
    "Do not guess locations, claim tests passed, or broaden scope silently.",
  ].join(" ");
  return context.slice(0, MAX_CONTEXT_CHARS);
}

export function handleEvent(event) {
  const context = buildContext(promptFromEvent(event));
  if (!context) return null;
  return {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: context,
    },
  };
}

async function main() {
  let event;
  try {
    event = JSON.parse(await new Response(process.stdin).text());
  } catch {
    return;
  }
  const output = handleEvent(event);
  if (output) process.stdout.write(JSON.stringify(output));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}

