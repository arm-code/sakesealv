import type { Book, UpdateBookMetadataInput } from "@/lib/server/domain/book";

export function toUpdateMetadataInput(existing: Book, cover: string): UpdateBookMetadataInput {
  return {
    zLibId: existing.zLibId,
    title: existing.title,
    author: existing.author,
    publisher: existing.publisher,
    series: existing.series,
    volume: existing.volume,
    series_index: existing.series_index,
    edition: existing.edition,
    identifier: existing.identifier,
    pages: existing.pages,
    description: existing.description,
    google_books_id: existing.google_books_id,
    open_library_key: existing.open_library_key,
    hardcover_id: existing.hardcover_id ?? null,
    amazon_asin: existing.amazon_asin,
    external_rating: existing.external_rating,
    external_rating_count: existing.external_rating_count,
    cover,
    extension: existing.extension,
    filesize: existing.filesize,
    language: existing.language,
    year: existing.year,
    month: existing.month,
    day: existing.day,
    createdAt: existing.createdAt,
  };
}
