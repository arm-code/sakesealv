// Corre una vez al arrancar el servidor Next (no por request). `register` debe
// terminar antes de aceptar requests, así que los jobs se lanzan sin await.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startBackgroundJobs } = await import("@/lib/server/jobs/background-jobs");
  startBackgroundJobs();
}
