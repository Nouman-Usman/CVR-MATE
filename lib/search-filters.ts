export interface SearchFiltersState {
  query: string;
  industryText: string;
  industryCode: string;
  companyForm: string;
  size: string;
  zipcode: string;
  region: string;
  foundedPeriod: string;
  revenueMin: number;
  revenueMax: number;
  profitMin: number;
  profitMax: number;
  employeesMin: number;
  employeesMax: number;
}

type SearchParamReader = Pick<URLSearchParams, "get">;

export const DEFAULT_SEARCH_FILTERS: SearchFiltersState = {
  query: "",
  industryText: "",
  industryCode: "all",
  companyForm: "all",
  size: "all",
  zipcode: "",
  region: "all",
  foundedPeriod: "all",
  revenueMin: 0,
  revenueMax: 1000,
  profitMin: 0,
  profitMax: 1000,
  employeesMin: 0,
  employeesMax: 5000,
};

const companyFormCodeMap: Record<string, string> = {
  aps: "80",
  "a/s": "60",
  ivs: "81",
  "i/s": "30",
  enkeltmandsvirksomhed: "10",
};

const regionZipcodeMap: Record<string, string> = {
  hovedstaden: "1000,1100,1200,1300,1400,1500,1600,1700,1800,1900,2000,2100,2200,2300,2400,2450,2500,2600,2605,2610,2620,2625,2630,2635,2640,2650,2660,2665,2670,2680,2690,2700,2720,2730,2740,2750,2760,2765,2770,2791,2800,2820,2830,2840,2850,2860,2870,2880,2900,2920,2930,2942,2950,2960,2970,2980,2990,3000,3050,3060,3070,3080,3100,3120,3140,3150,3200,3210,3230,3250,3300,3310,3320,3330,3360,3370,3390,3400,3450,3460,3480,3490,3500,3520,3540",
  midtjylland: "7400,7430,7441,7442,7451,7470,7480,7490,7500,7540,7550,7560,7570,7600,7620,7650,7660,7670,7680,7700,7730,7741,7742,7752,7755,7760,7770,7790,8000,8200,8210,8220,8230,8240,8250,8260,8270,8300,8305,8310,8320,8330,8340,8350,8355,8360,8370,8380,8381,8382,8400,8410,8420,8444,8450,8462,8464,8471,8472,8500,8520,8530,8541,8543,8544,8550,8560,8570,8581,8585,8586,8592,8600,8620,8632,8641,8643,8653,8654,8660,8670,8680,8700,8721,8722,8723,8732,8740,8751,8752,8762,8763,8765,8766,8781,8783,8800,8830,8831,8832,8840,8850,8860,8870,8881,8882,8883,8900,8920,8930,8940,8950,8960,8961,8963,8970,8981,8983,8990",
  syddanmark: "5000,5200,5210,5220,5230,5240,5250,5260,5270,5290,5300,5320,5330,5350,5370,5380,5390,5400,5450,5462,5463,5464,5466,5471,5474,5485,5491,5492,5500,5540,5550,5560,5580,5591,5592,5600,5610,5620,5631,5642,5672,5683,5690,5700,5750,5762,5771,5772,5792,5800,5853,5854,5856,5863,5871,5874,5881,5882,5883,5884,5892,5900,5932,5935,5943,5953,5960,5970,5985,6000,6040,6051,6052,6064,6070,6091,6092,6093,6094,6100,6200,6230,6240,6261,6270,6280,6300,6310,6320,6330,6340,6360,6372,6392,6400,6430,6470,6500,6510,6520,6534,6535,6541,6560,6580,6600,6621,6622,6623,6630,6640,6650,6660,6670,6682,6683,6690,6700,6705,6710,6715,6720,6731,6740,6752,6753,6760,6771,6780,6792,6800,6818,6823,6830,6840,6851,6852,6853,6854,6855,6857,6862,6870,6880,7000,7007,7080,7100,7120,7130,7140,7150,7160,7171,7173,7182,7183,7184,7190,7200,7300,7321,7323",
  nordjylland: "7700,7730,7741,7742,7752,7755,7760,7770,7790,7800,7830,7840,7850,7860,7870,7884,7900,7950,7960,7970,7980,7990,7992,7993,7996,7998,8960,8961,8963,8970,8981,8983,8990,9000,9200,9210,9220,9230,9240,9260,9270,9280,9293,9300,9310,9320,9330,9340,9352,9362,9370,9380,9381,9382,9400,9430,9440,9460,9480,9490,9492,9493,9500,9510,9520,9530,9541,9550,9560,9574,9575,9600,9610,9620,9631,9632,9640,9670,9681,9690,9700,9740,9750,9760,9800,9830,9850,9870,9881,9900,9940,9970,9981,9982,9990",
  sjaelland: "4000,4030,4040,4050,4060,4070,4100,4130,4140,4160,4171,4173,4174,4180,4190,4200,4220,4230,4241,4242,4243,4250,4261,4262,4270,4281,4291,4293,4295,4296,4300,4320,4330,4340,4350,4360,4370,4390,4400,4420,4440,4450,4460,4470,4480,4490,4500,4520,4532,4534,4540,4550,4560,4571,4572,4573,4581,4583,4591,4592,4593,4600,4621,4622,4623,4632,4640,4652,4653,4654,4660,4671,4672,4673,4681,4682,4683,4684,4690,4700,4720,4733,4735,4736,4750,4760,4771,4772,4773,4780,4791,4792,4793,4800,4840,4850,4862,4863,4871,4872,4873,4880,4891,4892,4894,4895,4900,4912,4913,4920,4930,4941,4942,4943,4944,4951,4952,4953,4960,4970,4983,4990",
};

function foundedToDate(period: string): string | null {
  if (period === "all") return null;
  const map: Record<string, number> = { last30: 30, last90: 90, last365: 365, last3y: 1095 };
  const days = map[period];
  if (!days) return null;
  const d = new Date(Date.now() - days * 86400000);
  return d.toISOString().split("T")[0];
}

function sizeToEmploymentRange(size: string): { min?: number; max?: number } {
  if (size === "all") return {};
  if (size === "100+") return { min: 100 };
  const [low, high] = size.split("-").map(Number);
  return Number.isFinite(low) && Number.isFinite(high) ? { min: low, max: high } : {};
}

function setNumberParam(params: URLSearchParams, key: string, value: number | undefined) {
  if (value !== undefined && Number.isFinite(value)) params.set(key, String(value));
}

export function mergeSearchFilters(
  filters: Partial<SearchFiltersState>,
  base: SearchFiltersState = DEFAULT_SEARCH_FILTERS
): SearchFiltersState {
  return { ...base, ...filters };
}

export function hasNativeSearchFilter(filters: SearchFiltersState): boolean {
  return !!(
    filters.query ||
    filters.industryText ||
    filters.industryCode !== "all" ||
    filters.companyForm !== "all" ||
    filters.size !== "all" ||
    filters.zipcode ||
    filters.region !== "all" ||
    filters.foundedPeriod !== "all" ||
    filters.employeesMin > 0
  );
}

export function hasSegmentationFilter(filters: SearchFiltersState): boolean {
  return !!(
    filters.employeesMin > 0 ||
    filters.employeesMax < 5000 ||
    filters.revenueMin > 0 ||
    filters.revenueMax < 1000 ||
    filters.profitMin > 0 ||
    filters.profitMax < 1000
  );
}

export function buildSearchParamsFromState(filters: SearchFiltersState): URLSearchParams | null {
  const params = new URLSearchParams();

  if (filters.query) params.set("name", filters.query);

  if (filters.industryCode !== "all") {
    params.set("industry_code", filters.industryCode);
  } else if (filters.industryText) {
    params.set("industry_text", filters.industryText);
  }

  if (filters.companyForm !== "all") {
    const code = companyFormCodeMap[filters.companyForm];
    if (code) params.set("companyform_code", code);
  }

  if (filters.zipcode) params.set("zipcode", filters.zipcode);
  if (!filters.zipcode && filters.region !== "all") {
    const zips = regionZipcodeMap[filters.region];
    if (zips) params.set("zipcode_list", zips);
  }

  const lifeStart = foundedToDate(filters.foundedPeriod);
  if (lifeStart) params.set("life_start", lifeStart);

  const sizeRange = sizeToEmploymentRange(filters.size);
  const employeeMin = filters.employeesMin > 0 ? filters.employeesMin : sizeRange.min;
  const employeeMax = filters.employeesMax < 5000 ? filters.employeesMax : sizeRange.max;
  if (employeeMin !== undefined) params.set("employment_interval_low", String(employeeMin));
  setNumberParam(params, "seg_employees_min", employeeMin);
  setNumberParam(params, "seg_employees_max", employeeMax);

  if (filters.revenueMin > 0) params.set("seg_revenue_min", String(filters.revenueMin));
  if (filters.revenueMax < 1000) params.set("seg_revenue_max", String(filters.revenueMax));
  if (filters.profitMin > 0) params.set("seg_profit_min", String(filters.profitMin));
  if (filters.profitMax < 1000) params.set("seg_profit_max", String(filters.profitMax));

  return params.toString() ? params : null;
}

export function serializeSearchFilters(filters: SearchFiltersState): Record<string, string> {
  const serialized: Record<string, string> = {};
  if (filters.query) serialized.name = filters.query;
  if (filters.industryText) serialized.industry_text = filters.industryText;
  if (filters.industryCode !== "all") serialized.industry_code = filters.industryCode;
  if (filters.companyForm !== "all") serialized.companyForm = filters.companyForm;
  if (filters.size !== "all") serialized.size = filters.size;
  if (filters.zipcode) serialized.zipcode = filters.zipcode;
  if (filters.region !== "all") serialized.region = filters.region;
  if (filters.foundedPeriod !== "all") serialized.foundedPeriod = filters.foundedPeriod;
  if (filters.employeesMin > 0) serialized.employeesMin = String(filters.employeesMin);
  if (filters.employeesMax < 5000) serialized.employeesMax = String(filters.employeesMax);
  if (filters.revenueMin > 0) serialized.revenueMin = String(filters.revenueMin);
  if (filters.revenueMax < 1000) serialized.revenueMax = String(filters.revenueMax);
  if (filters.profitMin > 0) serialized.profitMin = String(filters.profitMin);
  if (filters.profitMax < 1000) serialized.profitMax = String(filters.profitMax);
  return serialized;
}

function getNumber(params: SearchParamReader, key: string): number | undefined {
  const value = params.get(key);
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function hydrateSearchFiltersFromParams(params: SearchParamReader): {
  filters: Partial<SearchFiltersState>;
  hasParams: boolean;
} {
  const filters: Partial<SearchFiltersState> = {};

  const stringMappings: Array<[keyof SearchFiltersState, string]> = [
    ["query", "name"],
    ["industryText", "industry_text"],
    ["industryCode", "industry_code"],
    ["companyForm", "companyForm"],
    ["size", "size"],
    ["zipcode", "zipcode"],
    ["region", "region"],
    ["foundedPeriod", "foundedPeriod"],
  ];

  for (const [stateKey, paramKey] of stringMappings) {
    const value = params.get(paramKey);
    if (value) filters[stateKey] = value as never;
  }

  const numberMappings: Array<[keyof SearchFiltersState, string]> = [
    ["employeesMin", "employeesMin"],
    ["employeesMax", "employeesMax"],
    ["revenueMin", "revenueMin"],
    ["revenueMax", "revenueMax"],
    ["profitMin", "profitMin"],
    ["profitMax", "profitMax"],
  ];

  for (const [stateKey, paramKey] of numberMappings) {
    const value = getNumber(params, paramKey);
    if (value !== undefined) filters[stateKey] = value as never;
  }

  return {
    filters,
    hasParams: Object.keys(filters).length > 0,
  };
}
