import type { StoragePort } from "@/lib/server/application/ports";
import { mimeTypes } from "@/lib/server/constants/mime-types";
import { apiOk, type ApiResult } from "@/lib/server/http/api";

function normalizeKey(path: string): string {
  return path.replace(/^\/+/, "").replace(/\/+$/, "");
}

// El original interpolaba nombres de archivo sin escapar en el XML; aquí se
// escapan (un "&" o "<" en un nombre rompía el multistatus).
function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export class ListDavDirectoryUseCase {
  constructor(private readonly storage: StoragePort) {}

  async execute(input: { path: string }): Promise<ApiResult<{ xml: string }>> {
    const path = input.path === "" ? "" : normalizeKey(input.path);
    const objects = await this.storage.list(path);

    const entries = objects
      .map((obj) => {
        const ext = obj.key.split(".").pop()?.toLowerCase() || "default";
        const mime = mimeTypes[ext] || mimeTypes.default;
        const display = obj.key.split("/").pop() ?? obj.key;
        const href = `/${encodeURIComponent(obj.key)}`;

        return `
          <D:response>
            <D:href>${href}</D:href>
            <D:propstat>
              <D:prop>
                <D:resourcetype/>
                <D:getcontentlength>${obj.size}</D:getcontentlength>
                <D:getlastmodified>${obj.lastModified?.toUTCString() ?? ""}</D:getlastmodified>
                <D:getcontenttype>${mime}</D:getcontenttype>
                <D:displayname>${escapeXml(display)}</D:displayname>
              </D:prop>
              <D:status>HTTP/1.1 200 OK</D:status>
            </D:propstat>
          </D:response>`;
      })
      .join("");

    const xml = `
      <D:multistatus xmlns:D="DAV:">
        <D:response>
          <D:href>${path === "" ? "/" : `/${encodeURIComponent(path)}`}</D:href>
          <D:propstat>
            <D:prop>
              <D:resourcetype><D:collection/></D:resourcetype>
              <D:displayname>${path === "" ? "root" : escapeXml(path.split("/").pop() ?? "")}</D:displayname>
            </D:prop>
            <D:status>HTTP/1.1 200 OK</D:status>
          </D:propstat>
        </D:response>${entries}
      </D:multistatus>
    `;

    return apiOk({ xml: xml.trim() });
  }
}
