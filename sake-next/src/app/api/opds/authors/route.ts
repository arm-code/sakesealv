import { distinctValuesFeed, handleOpdsFeed } from "@/lib/server/opds/handlers";

export async function GET(request: Request) {
  return handleOpdsFeed(request, "opds.authors.failed", () =>
    distinctValuesFeed({
      title: "Authors",
      feedId: "urn:sake:opds:authors",
      selfUrl: "/api/opds/authors",
      entryIdPrefix: "urn:sake:opds:author:",
      pick: (book) => book.author,
    }),
  );
}
