import { booksFeed, handleOpdsFeed } from "@/lib/server/opds/handlers";

export async function GET(request: Request) {
  return handleOpdsFeed(request, "opds.random.books.failed", () =>
    booksFeed({
      title: "Random Books",
      feedId: "urn:sake:opds:random",
      selfUrl: "/api/opds/random",
      filter: () => Math.random() >= 0.5,
    }),
  );
}
