import { errorResponse } from "@/lib/server/http/api";
import { booksFeed, byTitle, handleOpdsFeed } from "@/lib/server/opds/handlers";

interface RouteParams {
  params: Promise<{ language: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { language: value } = await params;
  if (!value) {
    return errorResponse("Missing language parameter", 400);
  }

  return handleOpdsFeed(request, "opds.language.books.failed", () =>
    booksFeed({
      title: `Books in ${value.toUpperCase()}`,
      feedId: `urn:sake:opds:language:${encodeURIComponent(value)}`,
      selfUrl: `/api/opds/languages/${encodeURIComponent(value)}`,
      filter: (book) => book.language === value,
      sort: byTitle,
    }),
  );
}
