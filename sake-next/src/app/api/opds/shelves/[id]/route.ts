import { errorResponse } from "@/lib/server/http/api";
import { booksFeed, byTitle, handleOpdsFeed, loadShelves, OpdsHttpError } from "@/lib/server/opds/handlers";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  if (!id) {
    return errorResponse("Missing shelf ID parameter", 400);
  }
  const shelfId = parseInt(id, 10);
  if (Number.isNaN(shelfId)) {
    return errorResponse("Invalid shelf ID parameter", 400);
  }

  return handleOpdsFeed(request, "opds.shelf.books.failed", async () => {
    const shelf = (await loadShelves()).find((s) => s.id === shelfId);
    if (!shelf) {
      throw new OpdsHttpError("Shelf not found", 404);
    }
    return booksFeed({
      title: `Shelf: ${shelf.name}`,
      feedId: `urn:sake:opds:shelf:${shelfId}`,
      selfUrl: `/api/opds/shelves/${shelfId}`,
      filter: (book) => book.shelfIds.includes(shelfId),
      sort: byTitle,
    });
  });
}
