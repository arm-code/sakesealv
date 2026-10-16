import { getActivatedSearchProviders } from "@/lib/server/config/activated-search-providers";
import { SearchView } from "@/components/search/search-view";

// Los providers activos salen de ACTIVATED_PROVIDERS (servidor), no de una ruta de API.
export const dynamic = "force-dynamic";

export default function SearchPage() {
  return <SearchView activeProviders={getActivatedSearchProviders()} />;
}
