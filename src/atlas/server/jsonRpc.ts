/**
 * LSP base-protocol framing: `Content-Length: N\r\n\r\n<utf8 json>`.
 * Hand-rolled to keep the server dependency-free.
 */

export function encodeMessage(message: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([
    Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii"),
    body,
  ]);
}

const HEADER_END = Buffer.from("\r\n\r\n", "ascii");

export class JsonRpcReader {
  private buffer = Buffer.alloc(0);

  constructor(private readonly onMessage: (message: unknown) => void) {}

  push(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      const headerEnd = this.buffer.indexOf(HEADER_END);
      if (headerEnd < 0) return;
      const header = this.buffer.subarray(0, headerEnd).toString("ascii");
      const match = header.match(/Content-Length: *(\d+)/i);
      if (!match) {
        // malformed frame: drop the header and resync
        this.buffer = this.buffer.subarray(headerEnd + HEADER_END.length);
        continue;
      }
      const length = Number(match[1]);
      const bodyStart = headerEnd + HEADER_END.length;
      if (this.buffer.length < bodyStart + length) return;
      const body = this.buffer.subarray(bodyStart, bodyStart + length);
      this.buffer = this.buffer.subarray(bodyStart + length);
      this.onMessage(JSON.parse(body.toString("utf8")));
    }
  }
}
