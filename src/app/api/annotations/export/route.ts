import { annotationExportService } from "@/lib/server/application/composition";
import type { AnnotationExportFormat } from "@/lib/server/application/services/annotation-export-service";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { parseAnnotationQuery } from "@/lib/server/http/annotation-query";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");
  if (format !== "markdown" && format !== "json") {
    return errorResponse("format must be markdown or json", 400);
  }
  let query;
  try {
    query = parseAnnotationQuery(searchParams);
  } catch (cause) {
    return errorResponse(cause instanceof Error ? cause.message : "Invalid annotation query", 400);
  }

  const iterator = annotationExportService.stream(format as AnnotationExportFormat, query)[Symbol.asyncIterator]();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) controller.close();
        else controller.enqueue(encoder.encode(next.value));
      } catch (cause) {
        controller.error(cause);
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });
  const extension = format === "markdown" ? "md" : "json";
  return new Response(stream, {
    headers: {
      "Content-Type": format === "markdown" ? "text/markdown; charset=utf-8" : "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="sake-annotations.${extension}"`,
    },
  });
}
