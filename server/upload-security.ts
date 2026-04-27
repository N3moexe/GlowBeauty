type SupportedImageMime = "image/jpeg" | "image/png" | "image/webp";

function hasPrefix(buffer: Buffer, signature: number[]) {
  if (buffer.length < signature.length) return false;
  return signature.every((byte, index) => buffer[index] === byte);
}

export function detectImageMime(buffer: Buffer): SupportedImageMime | null {
  if (hasPrefix(buffer, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function verifyImageMime(
  buffer: Buffer,
  declaredMime: string
): { valid: boolean; detected: SupportedImageMime | null } {
  const detected = detectImageMime(buffer);
  if (!detected) {
    return { valid: false, detected: null };
  }
  return { valid: detected === declaredMime, detected };
}

