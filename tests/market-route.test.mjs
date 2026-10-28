import { afterEach, expect, test } from "bun:test";
import { GET } from "../app/api/market/route.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("rejects malformed ticker symbols without calling Yahoo Finance", async () => {
  globalThis.fetch = () => {
    throw new Error("Fetch should not be called for an invalid symbol");
  };

  const response = await GET(new Request("http://localhost/api/market?symbol=bad%20symbol"));

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "Enter a valid ticker symbol." });
});

test("maps Yahoo intraday quotes into chart candles", async () => {
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return Response.json({
      chart: {
        result: [{
          meta: {
            currency: "INR",
            exchangeName: "NSI",
            regularMarketPrice: 3500,
            chartPreviousClose: 3480,
          },
          timestamp: [1_700_000_000, 1_700_000_060],
          indicators: {
            quote: [{
              open: [3480, 3490],
              high: [3495, 3510],
              low: [3475, 3488],
              close: [3490, 3500],
              volume: [100, 120],
            }],
          },
        }],
      },
    });
  };

  const response = await GET(new Request("http://localhost/api/market?symbol=TCS.NS&timeframe=1D"));
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(requestedUrl).toContain("/TCS.NS?range=1d&interval=1m");
  expect(data.symbol).toBe("TCS.NS");
  expect(data.price).toBe(3500);
  expect(data.candles).toHaveLength(2);
  expect(data.candles[1]).toEqual({
    time: 1_700_000_060,
    open: 3490,
    high: 3510,
    low: 3488,
    close: 3500,
    volume: 120,
  });
});
