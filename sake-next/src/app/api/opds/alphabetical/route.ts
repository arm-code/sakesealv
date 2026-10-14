import { booksFeed, byTitle, handleOpdsFeed } from "@/lib/server/opds/handlers";

export async function GET(request: Request) {
  return handleOpdsFeed(request, "opds.alphabetical.failed", () =>
    booksFeed({
      title: "All Books (Alphabetical)",
      feedId: "urn:sake:opds:alphabetical",
      selfUrl: "/api/opds/alphabetical",
      sort: byTitle,
    }),
  );
}
