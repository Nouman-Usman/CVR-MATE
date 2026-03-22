export const DANISH_REGIONS = [
  { value: "nordjylland", label: "Region Nordjylland", zipcodes: "7700-7990,8500-8600,9000-9990" },
  { value: "midtjylland", label: "Region Midtjylland", zipcodes: "6900-6990,7000-7680,8000-8499,8600-8990" },
  { value: "syddanmark", label: "Region Syddanmark", zipcodes: "5000-5999,6000-6899,7100-7200" },
  { value: "hovedstaden", label: "Region Hovedstaden", zipcodes: "1000-2999,3000-3699" },
  { value: "sjaelland", label: "Region Sjælland", zipcodes: "3700-3799,4000-4999" },
] as const;

export const COMPANY_SIZE_TIERS = [
  { value: "1-4", label: "1–4 ansatte" },
  { value: "5-9", label: "5–9 ansatte" },
  { value: "10-19", label: "10–19 ansatte" },
  { value: "20-49", label: "20–49 ansatte" },
  { value: "50-99", label: "50–99 ansatte" },
  { value: "100+", label: "100+ ansatte" },
] as const;

export const INDUSTRY_CODES = [
  { code: "011", label: "011 – Dyrkning af etårige afgrøder" },
  { code: "012", label: "012 – Dyrkning af flerårige afgrøder" },
  { code: "014", label: "014 – Husdyravl" },
  { code: "016", label: "016 – Serviceydelser i forbindelse med landbrug" },
  { code: "100", label: "100 – Fremstilling af fødevarer" },
  { code: "220", label: "220 – Fremstilling af gummi- og plastprodukter" },
  { code: "250", label: "250 – Fremstilling af metalvarer" },
  { code: "310", label: "310 – Fremstilling af møbler" },
  { code: "410", label: "410 – Opførelse af bygninger" },
  { code: "420", label: "420 – Anlægsarbejder" },
  { code: "430", label: "430 – Specialiseret bygge- og anlægsvirksomhed" },
  { code: "451", label: "451 – Handel med biler og lette motorkøretøjer" },
  { code: "461", label: "461 – Agenturhandel" },
  { code: "462", label: "462 – Engroshandel med landbrugsprodukter" },
  { code: "463", label: "463 – Engroshandel med føde-, drikke- og tobaksvarer" },
  { code: "464", label: "464 – Engroshandel med husholdningsartikler" },
  { code: "466", label: "466 – Engroshandel med andre maskiner og andet udstyr" },
  { code: "469", label: "469 – Ikke-specialiseret engroshandel" },
  { code: "471", label: "471 – Detailhandel fra ikke-specialiserede forretninger" },
  { code: "472", label: "472 – Detailhandel med fødevarer i specialforretninger" },
  { code: "473", label: "473 – Detailhandel med brændstof" },
  { code: "474", label: "474 – Detailhandel med it- og kommunikationsudstyr" },
  { code: "475", label: "475 – Detailhandel med andre husholdningsartikler" },
  { code: "477", label: "477 – Detailhandel med andre varer" },
  { code: "478", label: "478 – Detailhandel fra stadepladser og markeder" },
  { code: "479", label: "479 – Detailhandel uden for butikker" },
  { code: "491", label: "491 – Passagertransport med jernbane" },
  { code: "493", label: "493 – Anden landpassagertransport" },
  { code: "494", label: "494 – Vejgodstransport" },
  { code: "551", label: "551 – Hoteller mv." },
  { code: "561", label: "561 – Restauranter" },
  { code: "562", label: "562 – Event catering og anden catering" },
  { code: "563", label: "563 – Barer" },
  { code: "581", label: "581 – Udgivelse af bøger og tidsskrifter" },
  { code: "582", label: "582 – Udgivelse af software" },
  { code: "611", label: "611 – Trådløs telekommunikation" },
  { code: "620", label: "620 – Computerprogrammering, konsulentbistand og lignende" },
  { code: "631", label: "631 – Databehandling, webhosting og lignende" },
  { code: "641", label: "641 – Pengeinstitutter" },
  { code: "642", label: "642 – Holdingselskaber" },
  { code: "649", label: "649 – Anden kreditgivning og finansiel leasing" },
  { code: "661", label: "661 – Finansiel formidling" },
  { code: "681", label: "681 – Køb og salg af egen fast ejendom" },
  { code: "682", label: "682 – Udlejning af egen fast ejendom" },
  { code: "683", label: "683 – Ejendomsmæglere mv." },
  { code: "691", label: "691 – Juridisk bistand" },
  { code: "692", label: "692 – Bogføring og revision, skatterådgivning" },
  { code: "702", label: "702 – Virksomhedsrådgivning" },
  { code: "711", label: "711 – Arkitektfirmaer og ingeniørrådgivning" },
  { code: "712", label: "712 – Afprøvning og teknisk analyse" },
  { code: "731", label: "731 – Reklamebureauer" },
  { code: "741", label: "741 – Specialiseret designvirksomhed" },
  { code: "742", label: "742 – Fotografisk virksomhed" },
  { code: "750", label: "750 – Dyrlæger" },
  { code: "771", label: "771 – Udlejning af motorkøretøjer" },
  { code: "782", label: "782 – Vikarbureauer" },
  { code: "791", label: "791 – Rejsebureauer og rejsearrangører" },
  { code: "801", label: "801 – Vagtvirksomhed" },
  { code: "811", label: "811 – Kombinerede serviceydelser" },
  { code: "812", label: "812 – Rengøringsvirksomhed" },
  { code: "813", label: "813 – Landskabspleje" },
  { code: "829", label: "829 – Andre forretningsserviceydelser" },
  { code: "851", label: "851 – Førskoleundervisning" },
  { code: "855", label: "855 – Anden undervisning" },
  { code: "862", label: "862 – Læge- og tandlægevirksomhed" },
  { code: "869", label: "869 – Sundhedsvæsen i øvrigt" },
  { code: "881", label: "881 – Social foranstaltninger uden botilbud for ældre" },
  { code: "900", label: "900 – Kreative aktiviteter, kunst og forlystelser" },
  { code: "931", label: "931 – Sports- og fritidsaktiviteter" },
  { code: "941", label: "941 – Erhvervs- og arbejdsgiverorganisationer" },
  { code: "949", label: "949 – Andre organisationer og foreninger" },
  { code: "960", label: "960 – Andre personlige serviceydelser" },
] as const;

export const COMPANY_FORMS = [
  { value: "aps", label: "ApS (Anpartsselskab)" },
  { value: "a/s", label: "A/S (Aktieselskab)" },
  { value: "i/s", label: "I/S (Interessentskab)" },
  { value: "k/s", label: "K/S (Kommanditselskab)" },
  { value: "enkeltmandsvirksomhed", label: "Enkeltmandsvirksomhed" },
  { value: "ivs", label: "IVS (Iværksætterselskab)" },
  { value: "p/s", label: "P/S (Partnerselskab)" },
  { value: "smba", label: "S.M.B.A." },
  { value: "forening", label: "Forening" },
  { value: "fond", label: "Fond" },
] as const;

export const REVENUE_STEPS = [
  0, 500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000, 25_000_000,
  50_000_000, 100_000_000, 250_000_000, 500_000_000, 1_000_000_000,
] as const;

export const EMPLOYEE_STEPS = [
  0, 1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000,
] as const;
export const FOUNDED_PRESETS = [
  { value: "24h", label: "Sidste 24 timer" },
  { value: "48h", label: "Sidste 48 timer" },
  { value: "1w", label: "Sidste uge" },
  { value: "1m", label: "Sidste måned" },
  { value: "custom", label: "Vælg interval" },
] as const;

// Map region to zipcode ranges for CVRAPI search
export function getZipcodesForRegion(regionValue: string): string {
  const region = DANISH_REGIONS.find(r => r.value === regionValue);
  return region?.zipcodes || "";
}
