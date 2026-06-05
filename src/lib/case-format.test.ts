import { describe, expect, it } from "vitest";
import { CASE_CATEGORIES, formatCaseId } from "./case-format";

describe("case-format", () => {
  it("formats a full structured case number", () => {
    expect(
      formatCaseId({
        case_number: "123",
        case_year: 2026,
        case_category: "مدني",
        court_location: "الإسماعيلية",
        court_name: "محكمة الإسماعيلية",
      }),
    ).toBe("123 / 2026 / مدني / الإسماعيلية");
  });

  it("falls back to court name when location is absent", () => {
    expect(
      formatCaseId({
        case_number: "45",
        case_year: 2025,
        case_category: "أسرة",
        court_name: "محكمة الأسرة",
      }),
    ).toBe("45 / 2025 / أسرة / محكمة الأسرة");
  });

  it("uses placeholders for missing fields", () => {
    expect(formatCaseId({})).toBe("— / — / — / —");
  });

  it("keeps the expected legal case categories", () => {
    expect(CASE_CATEGORIES).toEqual([
      "جنائي",
      "أسرة",
      "مدني",
      "عسكرية",
      "محاكم اقتصادية",
      "مجلس دولة",
      "إدارية عليا",
    ]);
  });
});
