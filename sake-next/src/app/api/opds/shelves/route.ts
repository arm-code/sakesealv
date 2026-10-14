import { handleOpdsFeed, loadShelves } from "@/lib/server/opds/handlers";
import { renderNavigationFeed } from "@/lib/server/opds/feed-builder";

export async function GET(request: Request) {
  return handleOpdsFeed(request, "opds.shelves.failed", async () => {
    const shelves = [...(await loadShelves())].sort((a, b) => a.sortOrder - b.sortOrder);
    const entries = shelves.map((shelf) => ({
      title: shelf.name,
      id: `urn:sake:opds:shelf:${shelf.id}`,
      url: `${shelf.id}`,
    }));
    return renderNavigationFeed("Shelves", "urn:sake:opds:shelves", entries, "/api/opds/shelves");
  });
}
