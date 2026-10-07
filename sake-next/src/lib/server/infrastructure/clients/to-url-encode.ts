export function toUrlEncoded(data: object): string {
  const params: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        params.push(`${encodeURIComponent(key)}[]=${encodeURIComponent(String(item))}`);
      }
    } else if (value !== undefined && value !== null) {
      params.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }

  return params.join("&");
}
