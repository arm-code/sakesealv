import { booksFeed, byTitle, handleOpdsFeed } from "@/lib/server/opds/handlers";

export async function GET(request: Request) {
  return handleOpdsFeed(request, "opds.read.failed", () =>
    booksFeed({
      title: "Read Books",
      feedId: "urn:sake:opds:read",
      selfUrl: "/api/opds/read",
      filter: (book) => book.read_at !== null,
      sort: byTitle,
    }),
  );
}
