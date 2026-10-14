import { distinctValuesFeed, handleOpdsFeed } from "@/lib/server/opds/handlers";

export async function GET(request: Request) {
  return handleOpdsFeed(request, "opds.languages.failed", () =>
    distinctValuesFeed({
      title: "Languages",
      feedId: "urn:sake:opds:languages",
      selfUrl: "/api/opds/languages",
      entryIdPrefix: "urn:sake:opds:language:",
      pick: (book) => book.language,
      entryTitle: (value) => value.toUpperCase(),
    }),
  );
}
