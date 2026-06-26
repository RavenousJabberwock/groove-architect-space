/**
 * Minimal ID3v2 reader: extracts the TIT2 (title) frame from the first
 * ~128 KB of an MP3 buffer. Returns null when no tag is present so the
 * caller can fall back to filename / URL slug.
 *
 * Supports ID3v2.3 and v2.4 with encodings 0 (ISO-8859-1), 1 (UTF-16 w/
 * BOM), and 3 (UTF-8). Synchsafe size parsing is applied at the header.
 */
export async function readId3Title(file: Blob): Promise<string | null> {
  try {
    const slice = file.slice(0, Math.min(file.size, 128 * 1024));
    const buf = new Uint8Array(await slice.arrayBuffer());
    if (buf.length < 10) return null;
    if (buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) return null; // "ID3"
    const version = buf[3];
    const size =
      ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    const end = Math.min(10 + size, buf.length);
    let i = 10;
    while (i + 10 <= end) {
      const id = String.fromCharCode(buf[i], buf[i + 1], buf[i + 2], buf[i + 3]);
      if (id === "\u0000\u0000\u0000\u0000") break;
      const frameSize =
        version === 4
          ? ((buf[i + 4] & 0x7f) << 21) |
            ((buf[i + 5] & 0x7f) << 14) |
            ((buf[i + 6] & 0x7f) << 7) |
            (buf[i + 7] & 0x7f)
          : (buf[i + 4] << 24) | (buf[i + 5] << 16) | (buf[i + 6] << 8) | buf[i + 7];
      if (frameSize <= 0 || i + 10 + frameSize > end) break;
      if (id === "TIT2") {
        const enc = buf[i + 10];
        const data = buf.subarray(i + 11, i + 10 + frameSize);
        return decodeFrameText(enc, data);
      }
      i += 10 + frameSize;
    }
    return null;
  } catch {
    return null;
  }
}

function decodeFrameText(enc: number, data: Uint8Array): string {
  let text = "";
  if (enc === 0) text = new TextDecoder("iso-8859-1").decode(data);
  else if (enc === 3) text = new TextDecoder("utf-8").decode(data);
  else if (enc === 1 || enc === 2) {
    const hasBom = data.length >= 2 && data[0] === 0xff && data[1] === 0xfe;
    const be = data.length >= 2 && data[0] === 0xfe && data[1] === 0xff;
    const label = be ? "utf-16be" : "utf-16le";
    text = new TextDecoder(label).decode(hasBom || be ? data.subarray(2) : data);
  } else text = new TextDecoder("utf-8").decode(data);
  return text.replace(/\0+$/g, "").trim() || "";
}

/** Best-effort title from a URL path: last segment, decoded, extension stripped. */
export function titleFromUrl(url: string): string {
  try {
    const path = new URL(url, "http://x").pathname;
    const last = decodeURIComponent(path.split("/").filter(Boolean).pop() ?? "");
    return last.replace(/\.[a-z0-9]+$/i, "") || url;
  } catch {
    return url;
  }
}
