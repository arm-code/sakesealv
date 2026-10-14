import { errorResponse } from "@/lib/server/http/api";
import { booksFeed, byTitle, handleOpdsFeed } from "@/lib/server/opds/handlers";

interface RouteParams {
  params: Promise<{ publisher: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { publisher: value } = await params;
  if (!value) {
    return errorResponse("Missing publisher parameter", 400);
  }

  return handleOpdsFeed(request, "opds.publisher.books.failed", () =>
    booksFeed({
      title: `Books from ${value}`,
      feedId: `urn:sake:opds:publisher:${encodeURIComponent(value)}`,
      selfUrl: `/api/opds/publishers/${encodeURIComponent(value)}`,
      filter: (book) => book.publisher === value,
      sort: byTitle,
    }),
  );
}
