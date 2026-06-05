export const CASE_CATEGORIES = [
  "جنائي",
  "أسرة",
  "مدني",
  "عسكرية",
  "محاكم اقتصادية",
  "مجلس دولة",
  "إدارية عليا",
];

export function formatCaseId(c: {
  case_number?: string | null;
  case_year?: number | null;
  case_category?: string | null;
  court_location?: string | null;
  court_name?: string | null;
}) {
  const num = c.case_number || "—";
  const year = c.case_year || "—";
  const cat = c.case_category || "—";
  const loc = c.court_location || c.court_name || "—";
  return `${num} / ${year} / ${cat} / ${loc}`;
}
