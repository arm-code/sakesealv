import { errorResponse } from "@/lib/server/http/api";
import { booksFeed, byTitle, handleOpdsFeed } from "@/lib/server/opds/handlers";

interface RouteParams {
  params: Promise<{ author: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { author: value } = await params;
  if (!value) {
    return errorResponse("Missing author parameter", 400);
  }

  return handleOpdsFeed(request, "opds.author.books.failed", () =>
    booksFeed({
      title: `Books by ${value}`,
      feedId: `urn:sake:opds:author:${encodeURIComponent(value)}`,
      selfUrl: `/api/opds/authors/${encodeURIComponent(value)}`,
      filter: (book) => book.author === value,
      sort: byTitle,
    }),
  );
}
