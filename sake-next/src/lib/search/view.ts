import type { SearchBooksRequest, SearchProviderId } from "@/lib/types/search";

// Helpers de la vista de búsqueda (portados de searchView.ts del original).

const PROVIDERS_KEY = "sake.search.providers";
const COLLAPSED_KEY = "sake.search.provider-groups.collapsed";
const FILTERS_KEY = "sake.search.filters";

export const SEARCH_PROVIDER_OPTIONS: ReadonlyArray<{ value: SearchProviderId; label: string }> = [
  { value: "zlibrary", label: "Z-Library" },
  { value: "anna", label: "Anna's Archive" },
  { value: "openlibrary", label: "OpenLibrary" },
  { value: "gutenberg", label: "Gutenberg" },
];

export const SEARCH_LANGUAGE_OPTIONS = [
  { value: "english", label: "English" },
  { value: "german", label: "German" },
  { value: "french", label: "French" },
  { value: "spanish", label: "Spanish" },
] as const;

export const SEARCH_FORMAT_OPTIONS = [
  { value: "epub", label: "epub" },
  { value: "mobi", label: "mobi" },
  { value: "pdf", label: "pdf" },
] as const;

export const SEARCH_SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "title_asc", label: "Title A-Z" },
  { value: "year_desc", label: "Year (newest)" },
  { value: "year_asc", label: "Year (oldest)" },
] as const;

export type SearchSortValue = NonNullable<SearchBooksRequest["sort"]>;

export interface SearchFilterPreferences {
  selectedLanguages: string[];
  selectedFormats: string[];
  selectedSort: SearchSortValue;
  onlyFilesAvailable: boolean;
}

export const DEFAULT_FILTERS: SearchFilterPreferences = {
  selectedLanguages: ["english", "german"],
  selectedFormats: ["epub"],
  selectedSort: "relevance",
  onlyFilesAvailable: false,
};

export function providerLabel(id: SearchProviderId): string {
  return SEARCH_PROVIDER_OPTIONS.find((option) => option.value === id)?.label ?? id;
}

export function getDefaultSelectedProviders(active: SearchProviderId[]): SearchProviderId[] {
  if (active.includes("zlibrary")) return ["zlibrary"];
  return active[0] ? [active[0]] : [];
}

export function normalizeProviderSelection(values: string[], active: SearchProviderId[]): SearchProviderId[] {
  const allowed = new Set<string>(active);
  const normalized = [...new Set(values.filter((value): value is SearchProviderId => allowed.has(value)))];
  return normalized.length > 0 ? normalized : getDefaultSelectedProviders(active);
}

export function emptyCollapsedGroups(): Record<SearchProviderId, boolean> {
  return { zlibrary: false, anna: false, openlibrary: false, gutenberg: false };
}

export function bookCacheKey(provider: SearchProviderId, providerBookId: string): string {
  return `${provider}:${providerBookId}`;
}

export function parseYearInput(value: string): number | undefined {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function formatFileSize(bytes: number | null): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return "Not available";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "Not available";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "Not available";
  return value.trim() || "Not available";
}

export function toGoogleBooksUrl(id: string | null | undefined): string | null {
  const trimmed = id?.trim();
  return trimmed ? `https://books.google.com/books?id=${encodeURIComponent(trimmed)}` : null;
}

export function toOpenLibraryUrl(key: string | null | undefined): string | null {
  const trimmed = key?.trim();
  if (!trimmed) return null;
  return `https://openlibrary.org${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

// --- Persistencia local (solo conveniencia; todo con try/catch) ---

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Solo conveniencia.
  }
}

export function loadStoredProviders(active: SearchProviderId[]): SearchProviderId[] | null {
  const parsed = readJson(PROVIDERS_KEY);
  if (!Array.isArray(parsed)) return null;
  const allowed = new Set<string>(active);
  const valid = [...new Set(parsed.map(String).filter((entry): entry is SearchProviderId => allowed.has(entry)))];
  return valid.length > 0 ? valid : null;
}

export const persistProviders = (providers: SearchProviderId[]) => writeJson(PROVIDERS_KEY, providers);

export function loadStoredCollapsed(): Record<SearchProviderId, boolean> | null {
  const parsed = readJson(COLLAPSED_KEY);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const value = parsed as Record<string, unknown>;
  return { zlibrary: value.zlibrary === true, anna: value.anna === true, openlibrary: value.openlibrary === true, gutenberg: value.gutenberg === true };
}

export const persistCollapsed = (collapsed: Record<SearchProviderId, boolean>) => writeJson(COLLAPSED_KEY, collapsed);

export function loadStoredFilters(): SearchFilterPreferences | null {
  const parsed = readJson(FILTERS_KEY);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const value = parsed as Record<string, unknown>;
  const pick = (raw: unknown, allowed: ReadonlyArray<{ value: string }>, fallback: string[]) =>
    Array.isArray(raw) ? [...new Set(raw.map(String).filter((entry) => allowed.some((option) => option.value === entry)))] : fallback;
  const sort = String(value.selectedSort ?? "");
  return {
    selectedLanguages: pick(value.selectedLanguages, SEARCH_LANGUAGE_OPTIONS, DEFAULT_FILTERS.selectedLanguages),
    selectedFormats: pick(value.selectedFormats, SEARCH_FORMAT_OPTIONS, DEFAULT_FILTERS.selectedFormats),
    selectedSort: SEARCH_SORT_OPTIONS.some((option) => option.value === sort) ? (sort as SearchSortValue) : DEFAULT_FILTERS.selectedSort,
    onlyFilesAvailable: value.onlyFilesAvailable === true,
  };
}

export const persistFilters = (filters: SearchFilterPreferences) => writeJson(FILTERS_KEY, filters);
