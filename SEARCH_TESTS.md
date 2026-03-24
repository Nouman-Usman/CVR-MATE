# Search Page — Filter & Segmentation Test Report

**Date:** 2026-03-24
**Page:** `app/search/page.tsx`
**API:** `app/api/cvr/search/route.ts` → `lib/cvr-api.ts` → `https://rest.cvrapi.dk/v2/dk/search/company`

---

## Filters (each tested independently)

### 1. Company Name (`name` → `life_name`)
- **Input:** `name=Novo Nordisk`
- **Output:** Total: 10 | Count: 3
  - NOVO NORDISK A/S (CVR: 24256790, City: Bagsværd)
  - NOVO NORDISK PHARMACEUTICALS A/S (CVR: 24257924, City: Bagsværd)
  - Novo Nordisk Denmark A/S (CVR: 38180045, City: København S)
- **Status:** PASS

### 2. Industry Text (`industry_text` → `industry_primary_text`)
- **Input:** `industry_text=Detailhandel`
- **Output:** Total: 10 | Count: 3
  - STS BILER A/S (Industry: Detailhandel med motorkøretøjer)
  - Carto A/S (Industry: Detailhandel med motorkøretøjer)
  - LMC BILER A/S (Industry: Detailhandel med motorkøretøjer)
- **Status:** PASS

### 3. Industry Code Dropdown (maps code → Danish text via `industryCodeToText`)
- **Mapping:** `"46"` → `"Engroshandel"`, `"47"` → `"Detailhandel"`, etc.
- **Sent as:** `industry_text=Engroshandel` (text search, not code)
- **Output:** Total: 10 — returns wholesale companies
- **Status:** PASS

### 4. Company Form (`companyform_description`)
- **Input:** `companyform_description=IVS`
- **Output:** Total: 7 | Count: 3
  - Arctineering IVS (Form: IVS)
  - HB Greenland Holding IVS (Form: IVS)
  - Grønlands Ejendomshandel IVS (Form: IVS)
- **Mapping:** `aps` → `"APS"`, `a/s` → `"A/S"`, `ivs` → `"IVS"`, `i/s` → `"I/S"`, `enkeltmandsvirksomhed` → `"ENK"`
- **Status:** PASS

### 5. Zipcode (`zipcode` → `address_zipcode`)
- **Input:** `zipcode=2800`
- **Output:** Total: 10 | Count: 3
  - CitNOW Nordic A/S (Zip: 2800, City: Kongens Lyngby)
  - Ensure International Pension Broker A/S (Zip: 2800, City: Kongens Lyngby)
  - COWI INTERNATIONAL A/S (Zip: 2800, City: Kgs. Lyngby)
- **Status:** PASS

### 6. Region (`region` → `zipcode_list` → `address_zipcode_list`)
- **Input:** Region Nordjylland → `zipcode_list=9000,9200,9210`
- **Output:** Total: 10 | Count: 3
  - INWIDO DENMARK A/S (Zip: 9000, City: Aalborg)
  - JYDSK VÆRKTØJ A/S (Zip: 9210, City: Aalborg SØ)
  - HF INVEST A/S (Zip: 9000, City: Aalborg)
- **Regions available:** `hovedstaden`, `midtjylland`, `syddanmark`, `nordjylland`, `sjaelland`
- **Note:** Zipcode takes priority over region (region is only sent when zipcode is empty)
- **Status:** PASS

### 7. Founded Date (`foundedPeriod` → `life_start`)
- **Input:** `life_start=2025-12-24` (last 90 days)
- **Output:** Total: 10 | Count: 3
  - Norqon A/S (Founded: 2026-02-02)
  - Cadarn Capital EU A/S (Founded: 2026-01-27)
  - IQVIA RDS Denmark A/S (Founded: 2025-12-29)
- **Periods:** `last30`, `last90`, `last365`, `last3y` — converted to date via `foundedToDate()`
- **Status:** PASS

### 8. Company Size / Employees (`size` → `employment_interval_low`)
- **Input:** `employment_interval_low=50`
- **Output:** Total: 10 | Count: 3
  - G.K.M. AKTIESELSKAB (Employees: 57)
  - KM RUSTFRI A/S (Employees: 54)
  - SØNDERGAARD EL A/S (Employees: 50)
- **Size dropdown options map to:** `"1-10"` → low=1, `"10-50"` → low=10, `"50-100"` → low=50, `"100+"` → low=100
- **Note:** employeesMin slider overrides size dropdown when > 0
- **Status:** PASS

### 9. No Filters (error case)
- **Input:** (empty)
- **Output:** `{"error": "At least one search filter is required"}` (HTTP 400)
- **Status:** PASS

### 10. Only Segmentation Filters (error case)
- **Input:** `seg_employees_max=100`
- **Output:** `{"error": "At least one search filter is required"}` (HTTP 400)
- **Note:** Segmentation requires at least one CVR API filter alongside it
- **Status:** PASS

---

## Segmentation (post-filters applied server-side after CVR API results)

### 11. Employees Max (`seg_employees_max`)
- **Input:** `industry_text=Detailhandel&seg_employees_max=20`
- **Output:** Total: 5 (filtered down from 10)
  - LMC BILER A/S (Employees: 17)
  - LHLL A/S (Employees: 19)
  - TANG BILER, HOLSTEBRO A/S (Employees: 14)
  - AUTOCENTRET A/S (Employees: 7)
  - Car-Room A/S (Employees: 1)
- **Logic:** Filters out companies with employee count > max. Keeps companies with null employee data.
- **Status:** PASS

### 12. Gross Profit Min (`seg_profit_min`)
- **Input:** `industry_text=Detailhandel&employment_interval_low=50&seg_profit_min=10`
- **Output:** Total: 10 | Count: 5
  - MAX DUE A/S (GrossProfit: 49,063,650)
  - DK COMPANY RETAIL A/S (GrossProfit: 21,687,911)
  - DK Company Con A/S (GrossProfit: 20,564,634)
  - DKV Retail A/S (GrossProfit: 23,798,960)
  - ARNE STUBBE AUTOMOBILER A/S (GrossProfit: 44,694,849)
- **Logic:** Filters by `accounting.documents[].summary.grossprofitloss`. Values in UI are millions (DKK). Companies without financial data are kept.
- **Status:** PASS

### 13. Revenue Filter (`seg_revenue_min`, `seg_revenue_max`)
- **Input:** `industry_text=Detailhandel&employment_interval_low=50&seg_revenue_max=50`
- **Output:** Total: 8 (filtered from 10)
- **Note:** CVR API `revenue` field is almost always `null` in Danish filings. Falls back to `grossprofitloss` as proxy. Companies without any financial data are kept.
- **Status:** PASS

---

## Combined Filter Tests

### 14. Name + Region + Company Form
- **Input:** `name=Holding&companyform_description=APS&zipcode_list=1000,...,2300`
- **Output:** Total: 10 | Count: 3
  - MILLFIELD HOLDING ApS (Form: APS, Zip: 2000)
  - Hegnshøj Holding ApS (Form: APS, Zip: 2100)
  - WG33 Holding ApS (Form: APS, Zip: 2100)
- **Status:** PASS

### 15. Pagination
- **Input:** `industry_text=Engroshandel&limit=2&page=1`
  - Page 1: count=2, total=10, hasMore=true → MABETEC NORDIC A/S, Langkilde A/S
- **Input:** `industry_text=Engroshandel&limit=2&page=2`
  - Page 2: count=2, total=10, hasMore=true → KNOWLEDGECOTTON APPAREL A/S, dormakaba Danmark A/S
- **Status:** PASS

---

## Bugs Fixed

1. **Revenue & Gross Profit sliders were non-functional** — `buildSearchParams()` never sent `revenueMin/Max` or `profitMin/Max` to the API. The CVR API doesn't support financial filtering natively, so we added server-side post-filtering using `accounting.documents[].summary.grossprofitloss`.

2. **Employees Max slider was non-functional** — only `employeesMin` was sent (via `employment_interval_low`). Added `seg_employees_max` post-filter that filters results by actual employee count from `employment.months[0].amount`.

3. **Size dropdown and employeesMin slider conflicted** — both wrote to the same `employment_interval_low` param, with the slider always overwriting the dropdown. Fixed so the slider only overrides when `employeesMin > 0`.

4. **`employeesMax` was missing from `buildSearchParams` dependency array** — caused stale closure. Added `employeesMax`, `revenueMin`, `revenueMax`, `profitMin`, `profitMax` to the deps.

---

## Data Notes

- **Revenue** is almost always `null` in CVR API responses (Danish accounting filings don't always report top-line revenue). The revenue slider uses `grossprofitloss` as a fallback proxy.
- **Gross Profit** (`grossprofitloss`) is commonly available for A/S and APS companies.
- **Employee counts** are sourced from `employment.months[0].amount` (latest monthly figure), falling back to `employment.years[0].amount`.
- **Segmentation post-filters keep companies that lack financial/employee data** — this prevents false exclusions for companies that haven't filed recent reports.
