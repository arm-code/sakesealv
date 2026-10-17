import { errorResponse } from "@/lib/server/http/api";
import { booksFeed, handleOpdsFeed } from "@/lib/server/opds/handlers";

interface RouteParams {
  params: Promise<{ series: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { series: value } = await params;
  if (!value) {
    return errorResponse("Missing series parameter", 400);
  }

  return handleOpdsFeed(request, "opds.series.books.failed", () =>
    booksFeed({
      title: `Series: ${value}`,
      feedId: `urn:sake:opds:series:${encodeURIComponent(value)}`,
      selfUrl: `/api/opds/series/${encodeURIComponent(value)}`,
      filter: (book) => book.series === value,
      sort: (a, b) => {
        const indexA = a.series_index ?? Number.MAX_VALUE;
        const indexB = b.series_index ?? Number.MAX_VALUE;
        return indexA !== indexB ? indexA - indexB : a.title.localeCompare(b.title);
      },
    }),
  );
}
