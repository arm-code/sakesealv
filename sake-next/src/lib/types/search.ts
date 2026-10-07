export const SEARCH_PROVIDER_IDS = ["zlibrary", "anna", "openlibrary", "gutenberg"] as const;

export type SearchProviderId = (typeof SEARCH_PROVIDER_IDS)[number];

export interface SearchProviderCapabilities {
  filesAvailable: boolean;
  metadataCompleteness: "low" | "medium" | "high";
}

export interface SearchBooksFilters {
  language?: string[];
  extension?: string[];
  yearFrom?: number;
  yearTo?: number;
  limitPerProvider?: number;
}

export interface SearchBooksRequest {
  query: string;
  providers?: SearchProviderId[];
  filters?: SearchBooksFilters;
  sort?: "relevance" | "year_desc" | "year_asc" | "title_asc";
}

export interface SearchResultBook {
  provider: SearchProviderId;
  providerBookId: string;
  title: string;
  author: string | null;
  language: string | null;
  year: number | null;
  extension: string | null;
  filesize: number | null;
  cover: string | null;
  description: string | null;
  series: string | null;
  volume: string | null;
  seriesIndex: number | null;
  identifier: string | null;
  isbn: string | null;
  pages: number | null;
  capabilities: SearchProviderCapabilities;
  downloadRef: string | null;
  queueRef: string | null;
  sourceUrl: string | null;
}

export interface SearchProviderFailure {
  provider: SearchProviderId;
  error: string;
}

export interface SearchBooksResponse {
  success: true;
  books: SearchResultBook[];
  meta: {
    requestedProviders: SearchProviderId[];
    fulfilledProviders: SearchProviderId[];
    failedProviders: SearchProviderFailure[];
  };
}
