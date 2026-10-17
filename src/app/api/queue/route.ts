import { getQueueStatusResponse } from "@/lib/server/http/get-queue-status-response";

export const dynamic = "force-dynamic";

export async function GET() {
  return getQueueStatusResponse();
}
