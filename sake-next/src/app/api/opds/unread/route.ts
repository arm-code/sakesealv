import { booksFeed, byTitle, handleOpdsFeed } from "@/lib/server/opds/handlers";

export async function GET(request: Request) {
  return handleOpdsFeed(request, "opds.unread.failed", () =>
    booksFeed({
      title: "Unread Books",
      feedId: "urn:sake:opds:unread",
      selfUrl: "/api/opds/unread",
      filter: (book) => book.read_at === null,
      sort: byTitle,
    }),
  );
}
