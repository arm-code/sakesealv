import { request } from "@/lib/client/api-client";
import type {
  AnnotationFacetsResponse,
  AnnotationHubItem,
  AnnotationListResponse,
  AnnotationQuery,
  DeleteAnnotationRequest,
  UpdateAnnotationRequest,
} from "@/lib/types/annotation";

export function annotationQueryParams(query: AnnotationQuery, includeCursor = true): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.type !== "all") params.set("type", query.type);
  if (query.bookId !== null) params.set("bookId", String(query.bookId));
  if (query.shelfId !== null) params.set("shelfId", String(query.shelfId));
  if (query.color) params.set("color", query.color);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.sort !== "newest") params.set("sort", query.sort);
  if (includeCursor && query.cursor) params.set("cursor", query.cursor);
  params.set("limit", String(query.limit));
  return params;
}

export const AnnotationsApi = {
  list: (query: AnnotationQuery) => request<AnnotationListResponse>(`/api/annotations?${annotationQueryParams(query)}`),
  get: (id: number) => request<AnnotationHubItem>(`/api/annotations/${id}`),
  facets: () => request<AnnotationFacetsResponse>("/api/annotations/facets"),
  update: (id: number, body: UpdateAnnotationRequest) =>
    request<AnnotationHubItem>(`/api/annotations/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number, body: DeleteAnnotationRequest) =>
    request<unknown>(`/api/annotations/${id}`, { method: "DELETE", body: JSON.stringify(body) }),
  reindex: () => request<unknown>("/api/annotations/reindex", { method: "POST", body: "{}" }),
  exportUrl: (query: AnnotationQuery, format: "markdown" | "json") => {
    const params = annotationQueryParams(query, false);
    params.set("format", format);
    return `/api/annotations/export?${params}`;
  },
};
