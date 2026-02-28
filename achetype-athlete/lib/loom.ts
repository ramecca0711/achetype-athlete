/**
 * AUTO-DOC: File overview
 * Purpose: Shared utility/helper module used by pages and components.
 * Related pages/files:
 * - `app/coach/clients/page.tsx`
 * - `app/coach/new-loom-upload/page.tsx`
 * - `app/coach/review-log/page.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
function extractLoomId(url: string): string | null {
  const patterns = [/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/, /loom\.com\/share\/([a-zA-Z0-9]+)/];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function isNoiseToken(value: string): boolean {
  if (!value) return true;
  if (/^(text|punct)$/i.test(value)) return true;
  if (/^[A-Z0-9]{14,}$/.test(value)) return true;
  if (/^[a-f0-9]{16,}$/i.test(value)) return true;
  return false;
}

function sanitizeTranscriptText(raw: string): string {
  const cleaned = raw
    .replace(/\s+/g, " ")
    .split(" ")
    .filter((token) => !isNoiseToken(token.trim()))
    .join(" ")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();

  return cleaned;
}

function isLikelySentence(value: string): boolean {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length < 24) return false;
  if (!/[a-z]/i.test(normalized)) return false;
  const words = normalized.split(" ").filter(Boolean);
  if (words.length < 5) return false;
  const noisyWords = words.filter((word) => isNoiseToken(word));
  return noisyWords.length <= Math.floor(words.length / 3);
}

const BODY_PART_PATTERNS = [
  "head",
  "neck",
  "shoulder",
  "rib",
  "chest",
  "spine",
  "trunk",
  "pelvis",
  "hip",
  "glute",
  "knee",
  "ankle",
  "foot"
];

const OBSERVATION_PATTERNS = [
  /\bsee\b/i,
  /\bnotice\b/i,
  /\bshows?\b/i,
  /\blooks?\b/i,
  /\bshift\b/i,
  /\btilt\b/i,
  /\brotation\b/i,
  /\btwist\b/i,
  /\basymmetr/i,
  /\blean\b/i,
  /\boff\b/i
];

function compactSentence(sentence: string): string {
  return sentence
    .replace(/\b(uh|um|like|you know)\b/gi, "")
    .replace(/\b(i (just )?(want|mean|think|guess|feel) to)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isObservationSentence(sentence: string): boolean {
  const hasBodyPart = BODY_PART_PATTERNS.some((part) => new RegExp(`\\b${part}s?\\b`, "i").test(sentence));
  const hasObservationVerb = OBSERVATION_PATTERNS.some((pattern) => pattern.test(sentence));
  return hasBodyPart || hasObservationVerb;
}

const EXCLUDE_PATTERNS = [
  /\bprice\b/i,
  /\bpay\b/i,
  /\bprogram\b/i,
  /\bmethod\b/i,
  /\bcoaching\b/i,
  /\bmessage me\b/i,
  /\bemail me\b/i,
  /\bif you have questions\b/i,
  /\bnext step\b/i,
  /\brecommend\b/i,
  /\bshould\b/i,
  /\bneed to\b/i,
  /\blet'?s\b/i,
  /\bwe('?re| are) going to\b/i
];

const PHYSICAL_PATTERNS = [
  /\bhead\b/i,
  /\bneck\b/i,
  /\bshoulder\b/i,
  /\bscap/i,
  /\brib\b/i,
  /\bchest\b/i,
  /\bspine\b/i,
  /\btrunk\b/i,
  /\btorso\b/i,
  /\bpelvis\b/i,
  /\bhip\b/i,
  /\bglute\b/i,
  /\bknee\b/i,
  /\bankle\b/i,
  /\bfoot\b/i,
  /\basymmetr/i,
  /\btilt\b/i,
  /\brotat/i,
  /\btwist\b/i,
  /\blean\b/i,
  /\bshift\b/i,
  /\bvalgus\b/i,
  /\bvarus\b/i
];

const DESCRIPTOR_RULES: Array<{ key: string; patterns: RegExp[] }> = [
  { key: "asymmetry", patterns: [/\basymmetr/i, /\buneven\b/i, /\bone side\b/i] },
  { key: "rotation", patterns: [/\brotat/i, /\btwist/i, /\bturned\b/i] },
  { key: "tilt", patterns: [/\btilt/i, /\blean/i, /\boff[- ]center\b/i] },
  { key: "shift", patterns: [/\bshift\b/i, /\bdrift\b/i] },
  { key: "tracking", patterns: [/\btrack/i, /\bcollapse\b/i, /\bvalgus\b/i, /\bvarus\b/i] },
  { key: "position", patterns: [/\bposition\b/i, /\bposture\b/i, /\balign/i] }
];

function enforceWordLimit(value: string, maxWords: number): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return value.trim();
  return `${words.slice(0, maxWords).join(" ").replace(/[.,;:!?]+$/, "")}.`;
}

function toShortObservation(region: string, descriptors: string[]): string {
  const distinct = Array.from(new Set(descriptors)).slice(0, 2);
  const raw = `${region}: ${distinct.join(" and ")} observed.`;
  return enforceWordLimit(raw, 15);
}

function stripLeadInPhrases(sentence: string): string {
  return sentence
    .replace(/^\s*(alright|okay|so|now)\b[:,]?\s*/i, "")
    .replace(/\bright off the bat\b[:,]?\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeTranscript(text: string): string {
  const normalized = sanitizeTranscriptText(text);
  if (!normalized) return "";
  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 15 && isLikelySentence(sentence));

  const filtered = sentences
    .map(stripLeadInPhrases)
    .map((value) => compactSentence(value))
    .filter((value) => value.length >= 20)
    .filter((value) => !EXCLUDE_PATTERNS.some((pattern) => pattern.test(value)))
    .filter((value) => PHYSICAL_PATTERNS.some((pattern) => pattern.test(value)))
    .filter((value) => isObservationSentence(value));

  const cleaned = filtered
    .map((value) => value
      .replace(/\b(front|side|back)\s+view[:,]?\s*/gi, "")
      .replace(/\s+/g, " ")
      .trim())
    .filter((value) => value.length >= 18);

  const archetypeDescriptors = new Set<string>();
  const lowerBodyDescriptors = new Set<string>();
  const ribShoulderDescriptors = new Set<string>();
  const globalDescriptors = new Set<string>();

  for (const sentence of cleaned) {
    const lower = sentence.toLowerCase();
    const descriptors = DESCRIPTOR_RULES
      .filter((rule) => rule.patterns.some((pattern) => pattern.test(lower)))
      .map((rule) => rule.key);

    if (!descriptors.length) continue;

    if (/\barchetype\b|\bstructure\b|\bframe\b|\ba frame\b|\bv frame\b|\bh frame\b/i.test(lower)) {
      descriptors.forEach((desc) => archetypeDescriptors.add(desc));
    }
    if (/\bhip\b|\bpelvis\b|\bglute\b|\bknee\b|\bankle\b|\bfoot\b|\blower body\b/i.test(lower)) {
      descriptors.forEach((desc) => lowerBodyDescriptors.add(desc));
    }
    if (/\brib\b|\bchest\b|\bshoulder\b|\bscap/i.test(lower)) {
      descriptors.forEach((desc) => ribShoulderDescriptors.add(desc));
    }
    if (/\bcenter of mass\b|\bposture\b|\bglobal\b|\boverall\b|\bshift\b|\blean\b/i.test(lower)) {
      descriptors.forEach((desc) => globalDescriptors.add(desc));
    }
  }

  const sectionBullets = {
    archetype: archetypeDescriptors.size
      ? [toShortObservation("structure", Array.from(archetypeDescriptors))]
      : [] as string[],
    lower: lowerBodyDescriptors.size
      ? [toShortObservation("lower body and pelvis", Array.from(lowerBodyDescriptors))]
      : [] as string[],
    rib: ribShoulderDescriptors.size
      ? [toShortObservation("ribcage and shoulders", Array.from(ribShoulderDescriptors))]
      : [] as string[],
    global: globalDescriptors.size
      ? [toShortObservation("center of mass and posture", Array.from(globalDescriptors))]
      : [] as string[]
  };

  const totalBullets =
    sectionBullets.archetype.length +
    sectionBullets.lower.length +
    sectionBullets.rib.length +
    sectionBullets.global.length;

  if (totalBullets < 6) {
    // Fill from strongest raw observations while staying short and neutral.
    for (const sentence of cleaned) {
      const short = enforceWordLimit(sentence, 15);
      if (sectionBullets.global.includes(short)) continue;
      if (sectionBullets.lower.includes(short)) continue;
      if (sectionBullets.rib.includes(short)) continue;
      if (sectionBullets.archetype.includes(short)) continue;
      if (/\bhip\b|\bpelvis\b|\bknee\b|\bankle\b|\bfoot\b/i.test(sentence) && sectionBullets.lower.length < 4) {
        sectionBullets.lower.push(short);
      } else if (/\brib\b|\bchest\b|\bshoulder\b/i.test(sentence) && sectionBullets.rib.length < 4) {
        sectionBullets.rib.push(short);
      } else if (/\barchetype\b|\bstructure\b|\bframe\b/i.test(sentence) && sectionBullets.archetype.length < 3) {
        sectionBullets.archetype.push(short);
      } else if (sectionBullets.global.length < 4) {
        sectionBullets.global.push(short);
      }
      const count =
        sectionBullets.archetype.length +
        sectionBullets.lower.length +
        sectionBullets.rib.length +
        sectionBullets.global.length;
      if (count >= 10) break;
    }
  }

  const trimSection = (items: string[]) => items.slice(0, 3);
  const archetypeItems = trimSection(sectionBullets.archetype);
  const lowerItems = trimSection(sectionBullets.lower);
  const ribItems = trimSection(sectionBullets.rib);
  const globalItems = trimSection(sectionBullets.global);

  const ensureItem = (items: string[], fallback: string) => (items.length ? items : [fallback]);

  const finalArchetype = ensureItem(archetypeItems, "No explicit structure observation stated.");
  const finalLower = ensureItem(lowerItems, "No explicit lower body observation stated.");
  const finalRib = ensureItem(ribItems, "No explicit ribcage or shoulder observation stated.");
  const finalGlobal = ensureItem(globalItems, "No explicit global posture observation stated.");

  return [
    "Archetype/Structure:",
    ...finalArchetype.map((item) => `- ${enforceWordLimit(item, 15)}`),
    "Lower body & pelvis:",
    ...finalLower.map((item) => `- ${enforceWordLimit(item, 15)}`),
    "Ribcage & shoulders:",
    ...finalRib.map((item) => `- ${enforceWordLimit(item, 15)}`),
    "Center of mass / global posture:",
    ...finalGlobal.map((item) => `- ${enforceWordLimit(item, 15)}`)
  ].join("\n");
}

function extractTranscriptText(payload: any): string | null {
  if (!payload) return null;
  if (typeof payload === "string") {
    const cleaned = sanitizeTranscriptText(payload);
    return cleaned || null;
  }

  if (Array.isArray(payload)) {
    const fromArray = payload
      .map((row) => (typeof row === "string" ? row : row?.text))
      .filter(Boolean)
      .join(" ");
    const cleaned = sanitizeTranscriptText(fromArray);
    return cleaned || null;
  }

  const direct =
    payload?.transcript_text ??
    payload?.text ??
    (Array.isArray(payload?.transcript) ? payload.transcript.map((row: any) => row?.text).join(" ") : null) ??
    (Array.isArray(payload?.segments) ? payload.segments.map((row: any) => row?.text).join(" ") : null) ??
    (Array.isArray(payload?.words) ? payload.words.map((row: any) => row?.text).join(" ") : null) ??
    payload?.captions?.en;

  if (typeof direct === "string" && direct.trim()) {
    const cleaned = sanitizeTranscriptText(direct);
    return cleaned || null;
  }

  // Recursive fallback for nested transcript payloads.
  const collected: string[] = [];
  const visit = (value: any) => {
    if (!value) return;
    if (typeof value === "string") {
      const trimmed = sanitizeTranscriptText(value.trim());
      if (isLikelySentence(trimmed)) collected.push(trimmed);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (typeof value === "object") {
      const maybeText = value.text ?? value.caption ?? value.sentence ?? value.value;
      if (typeof maybeText === "string" && maybeText.trim()) {
        const cleaned = sanitizeTranscriptText(maybeText.trim());
        if (isLikelySentence(cleaned)) {
          collected.push(cleaned);
        }
      }
      for (const child of Object.values(value)) visit(child);
    }
  };
  visit(payload);

  const fallback = collected.join(" ").replace(/\s+/g, " ").trim();
  return fallback || null;
}

function decodeEscapedUrl(raw: string): string {
  return raw
    .replace(/\\u002F/g, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .trim();
}

async function fetchPublicTranscriptFromSharePage(loomId: string): Promise<string | null> {
  try {
    const shareRes = await fetch(`https://www.loom.com/share/${loomId}`, {
      cache: "no-store",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; ArchetypeAthlete/1.0)"
      }
    });
    if (!shareRes.ok) return null;
    const html = await shareRes.text();

    const matchers = [
      /https:\\\/\\\/cdn\.loom\.com\\\/mediametadata\\\/transcription\\\/[^"'\\\s<]+/i,
      /https:\/\/cdn\.loom\.com\/mediametadata\/transcription\/[^"'\s<]+/i
    ];
    const rawMatch = matchers.map((matcher) => html.match(matcher)?.[0]).find(Boolean);
    if (!rawMatch) return null;
    const transcriptUrl = decodeEscapedUrl(rawMatch);

    const transcriptRes = await fetch(transcriptUrl, { cache: "no-store" });
    if (!transcriptRes.ok) return null;
    const data = await transcriptRes.json();
    return extractTranscriptText(data);
  } catch {
    return null;
  }
}

export async function fetchLoomTranscriptSummary(loomUrl: string): Promise<string | null> {
  const loomId = extractLoomId(loomUrl);
  if (!loomId) return null;

  const token = process.env.LOOM_API_KEY;
  const endpoints = [
    `https://api.loom.com/v1/videos/${loomId}/transcript`,
    `https://www.loom.com/v1/videos/${loomId}/transcript`
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        cache: "no-store"
      });

      if (!response.ok) continue;

      const data = await response.json();
      const transcript = extractTranscriptText(data);
      if (transcript) return summarizeTranscript(transcript);
    } catch {
      continue;
    }
  }

  const publicTranscript = await fetchPublicTranscriptFromSharePage(loomId);
  if (publicTranscript) return summarizeTranscript(publicTranscript);

  return null;
}
