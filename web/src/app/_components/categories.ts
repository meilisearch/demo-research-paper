export const CATEGORY_NAMES: Record<string, string> = {
  "cs.AI": "Artificial Intelligence",
  "cs.LG": "Machine Learning",
  "cs.CL": "Computation & Language",
  "cs.CV": "Computer Vision",
  "cs.IR": "Information Retrieval",
  "cs.RO": "Robotics",
  "cs.MA": "Multiagent Systems",
  "cs.NE": "Neural & Evolutionary",
  "stat.ML": "Statistics · ML",
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
