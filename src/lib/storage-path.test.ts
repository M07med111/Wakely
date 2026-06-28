import { describe, expect, it, vi } from "vitest";
import { createStoragePath } from "./storage-path";

describe("createStoragePath", () => {
  it("creates safe paths for Arabic PDF filenames", () => {
    vi.spyOn(Date, "now").mockReturnValue(1782400739808);
    vi.stubGlobal("crypto", { randomUUID: () => "file-id" });

    const path = createStoragePath(["f67e1754-a728-443c-938b-2bae44ca7d52", "poa"], {
      name: "اطار_رخمي_عبدالرحمن_محمد_ابراهيم.pdf",
      type: "application/pdf",
    });

    expect(path).toBe("f67e1754-a728-443c-938b-2bae44ca7d52/poa/1782400739808-file-id.pdf");
    expect(path).not.toContain("اطار");
  });

  it("uses a known image extension from the MIME type", () => {
    vi.spyOn(Date, "now").mockReturnValue(1782400739809);
    vi.stubGlobal("crypto", { randomUUID: () => "image-id" });

    expect(
      createStoragePath(["user", "case"], {
        name: "scan",
        type: "image/jpeg",
      }),
    ).toBe("user/case/1782400739809-image-id.jpg");
  });
});
