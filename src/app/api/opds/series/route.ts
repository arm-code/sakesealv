import { distinctValuesFeed, handleOpdsFeed } from "@/lib/server/opds/handlers";

export async function GET(request: Request) {
  return handleOpdsFeed(request, "opds.series.failed", () =>
    distinctValuesFeed({
      title: "Series",
      feedId: "urn:sake:opds:series",
      selfUrl: "/api/opds/series",
      entryIdPrefix: "urn:sake:opds:series:",
      pick: (book) => book.series,
    }),
  );
}
