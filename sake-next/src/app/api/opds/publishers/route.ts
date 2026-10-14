import { distinctValuesFeed, handleOpdsFeed } from "@/lib/server/opds/handlers";

export async function GET(request: Request) {
  return handleOpdsFeed(request, "opds.publishers.failed", () =>
    distinctValuesFeed({
      title: "Publishers",
      feedId: "urn:sake:opds:publishers",
      selfUrl: "/api/opds/publishers",
      entryIdPrefix: "urn:sake:opds:publisher:",
      pick: (book) => book.publisher,
    }),
  );
}
