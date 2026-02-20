const EIA_BASE_URL = "https://api.eia.gov/v2";

function getApiKey(): string {
  const key = process.env.EIA_API_KEY;
  if (!key) throw new Error("EIA_API_KEY environment variable is required");
  return key;
}

interface EiaPricePoint {
  period: string;
  value: number;
  seriesId: string;
  seriesName: string;
  unit: string;
}

/**
 * Fetch coal market sales price data from EIA API v2.
 * Covers Central Appalachian and Illinois Basin markets.
 */
export async function fetchCoalPrices(limit: number = 12): Promise<EiaPricePoint[]> {
  const apiKey = getApiKey();
  const url = `${EIA_BASE_URL}/coal/market-sales-price/data/?api_key=${apiKey}&frequency=quarterly&data[0]=price&sort[0][column]=period&sort[0][direction]=desc&length=${limit}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`EIA Coal API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const records = data.response?.data || [];

  return records.map((r: Record<string, unknown>) => ({
    period: String(r.period || ""),
    value: Number(r.price) || 0,
    seriesId: `coal-${String(r["mine-msha-id"] || r["coal-district"] || "unknown")}`,
    seriesName: `Coal - ${String(r["coal-district"] || r["mine-state"] || "US")}`,
    unit: "dollars per short ton",
  }));
}

/**
 * Fetch natural gas futures prices from EIA API v2.
 * Henry Hub natural gas spot/futures prices.
 */
export async function fetchNaturalGasPrices(limit: number = 12): Promise<EiaPricePoint[]> {
  const apiKey = getApiKey();
  const url = `${EIA_BASE_URL}/natural-gas/pri/fut/data/?api_key=${apiKey}&frequency=daily&data[0]=value&sort[0][column]=period&sort[0][direction]=desc&length=${limit}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`EIA Gas API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const records = data.response?.data || [];

  return records.map((r: Record<string, unknown>) => ({
    period: String(r.period || ""),
    value: Number(r.value) || 0,
    seriesId: `gas-${String(r["process"] || r["duoarea"] || "HH")}`,
    seriesName: `Natural Gas - ${String(r["process-name"] || r["area-name"] || "Henry Hub")}`,
    unit: "dollars per million BTU",
  }));
}

/**
 * Fetch all energy prices (coal + gas).
 */
export async function fetchAllPrices(limit: number = 12): Promise<EiaPricePoint[]> {
  const results: EiaPricePoint[] = [];

  try {
    const coal = await fetchCoalPrices(limit);
    results.push(...coal);
  } catch (err) {
    console.error("Coal price fetch failed:", err);
  }

  try {
    const gas = await fetchNaturalGasPrices(limit);
    results.push(...gas);
  } catch (err) {
    console.error("Gas price fetch failed:", err);
  }

  return results;
}
