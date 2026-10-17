import { handleOpdsFeed } from "@/lib/server/opds/handlers";
import { renderNavigationFeed } from "@/lib/server/opds/feed-builder";

const ENTRIES = [
  { title: "All Books (Alphabetical)", id: "urn:sake:opds:alphabetical", url: "alphabetical", description: "All books in the library, sorted alphabetically by title." },
  { title: "Random Books", id: "urn:sake:opds:random", url: "random", description: "Browse random books." },
  { title: "Read Books", id: "urn:sake:opds:read", url: "read", description: "Browse read books." },
  { title: "Unread Books", id: "urn:sake:opds:unread", url: "unread", description: "Browse unread books." },
  { title: "Authors", id: "urn:sake:opds:authors", url: "authors", description: "Browse books by author." },
  { title: "Series", id: "urn:sake:opds:series", url: "series", description: "Browse books by series." },
  { title: "Publishers", id: "urn:sake:opds:publishers", url: "publishers", description: "Browse books by publisher." },
  { title: "Languages", id: "urn:sake:opds:languages", url: "languages", description: "Browse books by language." },
  { title: "Shelves", id: "urn:sake:opds:shelves", url: "shelves", description: "Browse books by shelf." },
];

export async function GET(request: Request) {
  return handleOpdsFeed(request, "opds.feed.failed", async () =>
    renderNavigationFeed("Sake OPDS Catalog", "urn:sake:opds:root", ENTRIES, "/api/opds"),
  );
}
