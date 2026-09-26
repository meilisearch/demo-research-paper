export const CATEGORY_NAMES: Record<string, string> = {
  "cs.AI": "Artificial Intelligence",
  "cs.LG": "Machine Learning",
  "cs.CL": "Computation & Language",
  "cs.CV": "Computer Vision",
  "cs.IR": "Information Retrieval",
  "cs.RO": "Robotics",
  "cs.MA": "Multiagent Systems",
  "cs.NE": "Neural & Evolutionary",
  "stat.ML": "Statistical ML",
  "cs.CR": "Cryptography & Security",
  "cs.SE": "Software Engineering",
  "cs.HC": "Human-Computer Interaction",
  "eess.AS": "Audio & Speech",
  "eess.IV": "Image & Video Processing",
  "cs.SD": "Sound",
};

export const categoryName = (c: string) => CATEGORY_NAMES[c] ?? c;

export const formatCount = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n);

/** "2017-06-12" → "12 Jun 2017", the way arXiv prints dates. */
export const formatArxivDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "Ashish Vaswani" → "A. Vaswani", as in a reference list. */
export const initials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  const last = parts.pop();
  return `${parts.map((p) => `${p[0]}.`).join(" ")} ${last}`;
};
