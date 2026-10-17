import type { SearchProviderPort, ZLibraryPort } from "@/lib/server/application/ports";
import { AnnaArchiveSearchProvider } from "@/lib/server/infrastructure/search-providers/anna-archive-search-provider";
import { GutenbergSearchProvider } from "@/lib/server/infrastructure/search-providers/gutenberg-search-provider";
import { OpenLibrarySearchProvider } from "@/lib/server/infrastructure/search-providers/open-library-search-provider";
import { ZLibrarySearchProvider } from "@/lib/server/infrastructure/search-providers/zlibrary-search-provider";
import type { SearchProviderId } from "@/lib/types/search";

interface SearchProviderFactoryDependencies {
  zlibrary: ZLibraryPort;
}

export function createSearchProvider(providerId: SearchProviderId, dependencies: SearchProviderFactoryDependencies): SearchProviderPort {
  switch (providerId) {
    case "zlibrary":
      return new ZLibrarySearchProvider(dependencies.zlibrary);
    case "anna":
      return new AnnaArchiveSearchProvider();
    case "openlibrary":
      return new OpenLibrarySearchProvider();
    case "gutenberg":
      return new GutenbergSearchProvider();
    default: {
      const exhaustiveProviderId: never = providerId;
      throw new Error(`Unsupported search provider: ${exhaustiveProviderId}`);
    }
  }
}

export function createSearchProviders(providerIds: SearchProviderId[], dependencies: SearchProviderFactoryDependencies): SearchProviderPort[] {
  return providerIds.map((providerId) => createSearchProvider(providerId, dependencies));
}
