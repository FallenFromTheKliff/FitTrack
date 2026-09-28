const INTERNAL_LABEL_PATTERN =
  /\b(?:user|assistant|system|developer|model)[\s\p{P}]*(?:safety|reasoning|analysis|intent|classification|policy|instructions?)\s*[:=]|(?:^|\s)(?:analysis|reasoning|classification|intent|action\s+policy|allowed\s+actions?)\s*[:=]/iu;

const STATUS_LABEL_PATTERN =
  /\b(?:user[\s\p{P}]*)?safety[\s\p{P}]*(?:safe|unsafe|unknown|pass|fail|true|false|allow|deny|none)\b/iu;

const INTERNAL_XML_PATTERN =
  /<\s*\/?\s*(?:think|analysis|reasoning|system|developer|assistant|tool|function|response|json)\b[^>]*>/i;

const INTERNAL_XML_PREFIX_PATTERN =
  /<\s*\/?\s*(?:think|analysis|reasoning|system|developer|assistant|tool|function|response|json)\b/i;

const INTERNAL_ROLE_TOKEN_PATTERN =
  /(?:<\|\s*(?:assistant|system|developer|user|tool|function|end|start|im_start|im_end)\s*\|>|\[\s*(?:assistant|system|developer|user|tool)\s*\])/i;

const LINE_LABEL_PATTERN =
  /(?:^|\n)\s*(?:action|output|response|params?)\s*[:=]/i;

const CONTRACT_KEY_PATTERN =
  /(?:\\?["'])(?:content|reply|action|params|action_triggered|action_result|out_of_scope|sources|follow_up_suggestions)(?:\\?["'])\s*[:=]/gi;

const CONTRACT_KEYS = new Set([
  "content",
  "reply",
  "action",
  "params",
  "action_triggered",
  "action_result",
  "out_of_scope",
  "sources",
  "follow_up_suggestions",
]);

const MAX_JSON_INSPECTION_DEPTH = 128;
const MAX_JSON_INSPECTION_NODES = 4096;

export const AI_RESPONSE_TEXT_FALLBACK =
  "I couldn't format that response cleanly. Please try again.";

function hasInvalidCodeUnits(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (
      code === 0xfffd ||
      (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) ||
      (code >= 0x7f && code <= 0x9f)
    ) {
      return true;
    }

    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (
        !Number.isInteger(next) ||
        next < 0xdc00 ||
        next > 0xdfff
      ) {
        return true;
      }
      index += 1;
      continue;
    }

    if (code >= 0xdc00 && code <= 0xdfff) return true;
  }

  return false;
}

function inspectionText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u200b-\u200d\u2060\ufeff]/g, "")
    .replace(/[\*_~`#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function hasContractObject(value: unknown): boolean {
  const pending: Array<{ value: unknown; depth: number }> = [
    { value, depth: 0 },
  ];
  let visited = 0;

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;
    if (++visited > MAX_JSON_INSPECTION_NODES) return true;
    if (current.depth > MAX_JSON_INSPECTION_DEPTH) return true;

    if (Array.isArray(current.value)) {
      for (const entry of current.value) {
        pending.push({ value: entry, depth: current.depth + 1 });
      }
      continue;
    }

    if (typeof current.value !== "object" || current.value === null) {
      continue;
    }

    for (const [key, entry] of Object.entries(current.value)) {
      if (CONTRACT_KEYS.has(key)) return true;
      pending.push({ value: entry, depth: current.depth + 1 });
    }
  }

  return false;
}

function parseEmbeddedJson(value: string): unknown {
  let candidate = value.trim();

  for (let depth = 0; depth < 4; depth += 1) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate) as unknown;
    } catch {
      return null;
    }

    if (typeof parsed !== "string") return parsed;
    if (parsed === candidate) return parsed;
    candidate = parsed;
  }

  return null;
}

function isJsonContainer(value: unknown): value is object | unknown[] {
  return Array.isArray(value) || (typeof value === "object" && value !== null);
}

function hasStandaloneJsonContainer(value: string) {
  const trimmed = value.trim();
  if (!/^[\[{]/.test(trimmed)) return false;

  const markdownLinkAtStart = /^\[[^\]\r\n]+\]\s*\(/.test(trimmed);
  if (markdownLinkAtStart) return false;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return Array.isArray(parsed) || (typeof parsed === "object" && parsed !== null);
  } catch {
    return true;
  }
}

function hasEmbeddedContract(value: string) {
  const parsed = parseEmbeddedJson(value);
  if (
    isJsonContainer(parsed) ||
    hasContractObject(parsed) ||
    hasStandaloneJsonContainer(value)
  ) {
    return true;
  }

  const trimmed = value.trim();
  const malformedObjectWrapper =
    /^(?:\{|\[)\s*(?:\{\s*)?(?:["'][^"']+["']|[A-Za-z_$][\w$]*)\s*[:=]/.test(
      trimmed,
    );
  if (malformedObjectWrapper || /^\\?["](?:\{|\[)/.test(trimmed)) {
    return true;
  }
  const fence = String.fromCharCode(96).repeat(3);
  const fencedJson = trimmed.toLowerCase().startsWith(fence + "json");
  if (fencedJson) return true;

  const keyMatches = [...value.matchAll(CONTRACT_KEY_PATTERN)];
  if (!keyMatches.length) return false;

  return (
    keyMatches.length >= 2 ||
    /^(?:```(?:json)?\s*)?(?:\{|\[|\\?"(?:\{|\[))/.test(trimmed)
  );
}

/** Returns true only for intact, user-facing text from a validated chat response. */
export function isValidAiResponseText(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim() || hasInvalidCodeUnits(value)) {
    return false;
  }

  const inspected = inspectionText(value);
  if (
    INTERNAL_LABEL_PATTERN.test(inspected) ||
    STATUS_LABEL_PATTERN.test(inspected) ||
    LINE_LABEL_PATTERN.test(
      value
        .normalize("NFKC")
        .replace(/[\u200b-\u200d\u2060\ufeff]/g, "")
        .replace(/[\*_~`#]/g, ""),
    ) ||
    INTERNAL_XML_PATTERN.test(inspected) ||
    INTERNAL_XML_PREFIX_PATTERN.test(inspected) ||
    INTERNAL_ROLE_TOKEN_PATTERN.test(inspected) ||
    hasEmbeddedContract(value)
  ) {
    return false;
  }

  return true;
}

/** Keeps stale or cached assistant history from rendering internal payloads. */
export function guardAiResponseText(value: unknown) {
  return isValidAiResponseText(value) ? value : AI_RESPONSE_TEXT_FALLBACK;
}
