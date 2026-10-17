import { getReadingActivityStatsUseCase } from "@/lib/server/application/composition";
import { requireSession } from "@/lib/server/auth/require-session";
import { errorResponse } from "@/lib/server/http/api";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";

const DEFAULT_DAYS = 365;
const MIN_DAYS = 30;
const MAX_DAYS = 730;

export async function GET(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const daysRaw = new URL(request.url).searchParams.get("days");
  const parsedDays = daysRaw ? Number.parseInt(daysRaw, 10) : DEFAULT_DAYS;

  if (!Number.isFinite(parsedDays) || parsedDays < MIN_DAYS || parsedDays > MAX_DAYS) {
    logger.warn(
      { event: "stats.reading_activity.validation_failed", daysRaw },
      `Invalid days parameter. Expected ${MIN_DAYS}-${MAX_DAYS}`,
    );
    return errorResponse(`days must be between ${MIN_DAYS} and ${MAX_DAYS}`, 400);
  }

  try {
    const result = await getReadingActivityStatsUseCase.execute({ days: parsedDays });
    if (!result.ok) {
      logger.warn(
        { event: "stats.reading_activity.use_case_failed", days: parsedDays, statusCode: result.error.status, reason: result.error.message },
        "Reading activity stats rejected",
      );
      return errorResponse(result.error.message, result.error.status);
    }
    return Response.json(result.value);
  } catch (cause) {
    logger.error({ event: "stats.reading_activity.failed", days: parsedDays, error: toLogError(cause) }, "Failed to fetch reading activity stats");
    return errorResponse("Failed to fetch reading activity stats", 500);
  }
}
