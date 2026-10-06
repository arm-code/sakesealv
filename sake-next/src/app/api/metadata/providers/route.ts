import { activatedMetadataProviders } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";

export async function GET() {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  if (activatedMetadataProviders.length === 0) {
    return errorResponse("Metadata lookup is not enabled", 404);
  }

  const providers = activatedMetadataProviders.map((p) => ({
    id: p.id,
    capabilities: {
      touchedFields: [...p.capabilities.touchedFields],
      hasCover: p.capabilities.hasCover,
      hasRating: p.capabilities.hasRating,
      requiresIsbn: p.capabilities.requiresIsbn,
    },
  }));

  return Response.json({ providers });
}
