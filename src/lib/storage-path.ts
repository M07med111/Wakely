const MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

type StorageFile = Pick<File, "name" | "type">;

function extensionFromName(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]{1,10})$/);
  return match?.[1] ?? null;
}

function extensionForFile(file: StorageFile) {
  return MIME_EXTENSIONS[file.type] ?? extensionFromName(file.name) ?? "bin";
}

function randomId() {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export function createStoragePath(segments: string[], file: StorageFile) {
  const safeSegments = segments.map((segment) => segment.replace(/[^a-zA-Z0-9_-]/g, "-"));
  const ext = extensionForFile(file).replace(/[^a-z0-9]/g, "") || "bin";
  return [...safeSegments, `${Date.now()}-${randomId()}.${ext}`].join("/");
}
