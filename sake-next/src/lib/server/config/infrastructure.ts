import { resolveInfrastructureConfig } from "./infrastructure.shared.js";

let cachedConfig: ReturnType<typeof resolveInfrastructureConfig> | null = null;

export function getInfrastructureConfig(): ReturnType<
  typeof resolveInfrastructureConfig
> {
  if (!cachedConfig) {
    cachedConfig = resolveInfrastructureConfig(process.env);
  }

  return cachedConfig;
}

export function getLibsqlConfig() {
  return getInfrastructureConfig().libsql;
}

export function getS3Config() {
  return getInfrastructureConfig().s3;
}
