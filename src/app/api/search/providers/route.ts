import { requireSession } from "@/lib/server/auth/require-session";
import { getActivatedSearchProviders } from "@/lib/server/config/activated-search-providers";

export const dynamic = "force-dynamic";

// El layout del shell es client component: de aquí sabe si mostrar "Search" en el sidebar.
export async function GET() {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  return Response.json({ success: true, providers: getActivatedSearchProviders() });
}
