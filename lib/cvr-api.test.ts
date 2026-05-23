import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCompanyByVat } from "./cvr-api";
import { cacheGet, cacheSet } from "@/lib/redis";

// Mock redis
vi.mock("@/lib/redis", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheDel: vi.fn(),
  isRedisAvailable: vi.fn(() => true),
}));

// We'll also need to override fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("getCompanyByVat", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv, CVR_API_KEY: "test-api-key" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return cached data if available", async () => {
    const mockCompany = { vat: 12345678, name: "Cached Company" };
    vi.mocked(cacheGet).mockResolvedValueOnce(mockCompany);

    const result = await getCompanyByVat(12345678);

    expect(result).toEqual(mockCompany);
    expect(cacheGet).toHaveBeenCalledWith("company:12345678");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should fetch company from API if not cached", async () => {
    const mockCompany = { vat: 12345678, name: "Fetched Company" };
    vi.mocked(cacheGet).mockResolvedValueOnce(null);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockCompany,
    });

    const result = await getCompanyByVat(12345678);

    expect(result).toEqual(mockCompany);
    expect(cacheGet).toHaveBeenCalledWith("company:12345678");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const fetchArgs = mockFetch.mock.calls[0];
    expect(fetchArgs[0]).toBe("https://rest.cvrapi.dk/v2/dk/company/12345678");
    expect(fetchArgs[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Basic dGVzdC1hcGkta2V5Og==",
        }),
      })
    );
    expect(cacheSet).toHaveBeenCalledWith("company:12345678", mockCompany, 86400);
  });

  it("should throw an error if API fetch fails", async () => {
    vi.mocked(cacheGet).mockResolvedValueOnce(null);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => "Not Found",
    });

    await expect(getCompanyByVat(12345678)).rejects.toThrow("CVR API 404: Not Found");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(cacheSet).not.toHaveBeenCalled();
  });

  it("should throw an error if CVR_API_KEY is not configured", async () => {
    delete process.env.CVR_API_KEY;
    vi.mocked(cacheGet).mockResolvedValueOnce(null);

    await expect(getCompanyByVat(12345678)).rejects.toThrow("CVR_API_KEY is not configured");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
