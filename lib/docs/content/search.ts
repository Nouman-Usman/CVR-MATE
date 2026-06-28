import type { DocPage } from "../types";

export const searchDoc: DocPage = {
  slug: "search",
  title: { en: "Search", da: "Søg virksomheder" },
  description: {
    en: "Find Danish registered companies using CVR-backed search filters, guided dropdowns, and app-side segmentation for financial and employee ranges.",
    da: "Find danske registrerede virksomheder med CVR-understøttede søgefiltre, guidede dropdowns og app-side segmentering for økonomi- og medarbejderintervaller.",
  },
  heroScreenshot: {
    slug: "search/overview",
    alt: { en: "Search page overview", da: "Søgesideoversigt" },
  },
  sections: [
    {
      id: "filters",
      title: { en: "Filters", da: "Filtre" },
      body: {
        en: "The filter sidebar lets you narrow CVR companies with documented CVR API fields first, then optional app-side segmentation. All active filters combine with AND logic, so each extra filter makes the audience smaller.",
        da: "Filtersidebjælken lader dig indsnævre CVR-virksomheder med dokumenterede CVR API-felter først og derefter valgfri app-side segmentering. Alle aktive filtre kombineres med AND-logik, så hvert ekstra filter gør målgruppen mindre.",
      },
      features: {
        en: [
          "Company name — searches official names, CVR numbers, slugs, secondary names, and subsidiaries where available.",
          "Industry — use a DB07/NACE code or text for primary industry; secondary industry can also be searched by code or text.",
          "Location — city, postal code, region postcode bundles, street, street code, house number, letter, or municipality code.",
          "Company form — use dropdown options for common forms such as ApS, A/S, I/S, sole proprietorship, foundation, association, and more.",
          "Status — use the CVR status dropdown, including active, dissolved, bankruptcy, reconstruction, liquidation, and closed statuses.",
          "Contact — phone, email, and website fields can narrow companies with known contact data.",
          "Capital and identifiers — filter by share capital, currency, IPO flag, EAN ID, or LEI ID.",
        ],
        da: [
          "Virksomhedsnavn — søger i officielle navne, CVR-numre, slugs, binavne og datterselskaber hvor data findes.",
          "Branche — brug DB07/NACE-kode eller tekst for primær branche; sekundær branche kan også søges med kode eller tekst.",
          "Lokation — by, postnummer, regionale postnummerpakker, gade, vejkode, husnummer, bogstav eller kommunekode.",
          "Selskabsform — brug dropdown-valg for almindelige former som ApS, A/S, I/S, enkeltmandsvirksomhed, fond, forening og flere.",
          "Status — brug CVR-status-dropdown, inkl. aktiv, opløst, konkurs, rekonstruktion, likvidation og lukket.",
          "Kontakt — telefon, email og website kan indsnævre virksomheder med kendte kontaktdata.",
          "Kapital og identifikatorer — filtrer på selskabskapital, valuta, børsnotering, EAN-id eller LEI-id.",
        ],
      },
      screenshot: {
        slug: "search/filters-panel",
        alt: { en: "Search filters sidebar", da: "Søgefiltre sidebjælke" },
      },
    },
    {
      id: "dropdowns-and-help",
      title: { en: "Dropdowns and help", da: "Dropdowns og hjælp" },
      body: {
        en: "Several filters use dropdowns instead of free-text fields to reduce invalid records and match the values supported by CVR. Use the ? button beside a filter to see what it does, why it is useful, and examples of valid input.",
        da: "Flere filtre bruger dropdowns i stedet for fritekstfelter for at reducere ugyldige værdier og matche de værdier, CVR understøtter. Brug ?-knappen ved siden af et filter for at se hvad det gør, hvorfor det er nyttigt, og eksempler på gyldigt input.",
      },
      features: {
        en: [
          "Company form, company status, holding company, bankruptcy status, capital currency, and IPO status are guided dropdowns.",
          "The help modal is available in both English and Danish and follows the selected app language.",
          "Use exact IDs, such as EAN and LEI, only when you already know the identifier you want to match.",
        ],
        da: [
          "Selskabsform, virksomhedsstatus, holdingselskab, konkursstatus, kapitalvaluta og børsnotering er guidede dropdowns.",
          "Hjælpemodalen findes på både engelsk og dansk og følger det valgte appsprog.",
          "Brug præcise id'er, såsom EAN og LEI, kun når du allerede kender den identifikator, du vil matche.",
        ],
      },
      callout: {
        kind: "tip",
        en: "Dropdown filters are best when the value has a fixed official meaning. Text inputs remain for values that are naturally specific, such as company names, streets, websites, EAN IDs, and LEI IDs.",
        da: "Dropdownfiltre er bedst, når værdien har en fast officiel betydning. Tekstfelter bruges stadig til værdier, der naturligt er specifikke, såsom virksomhedsnavne, gader, websites, EAN-id'er og LEI-id'er.",
      },
    },
    {
      id: "marketing-opt-out",
      title: { en: "Marketing opt-out", da: "Marketingfravalg" },
      body: {
        en: "'Skip companies opted out for marketing' is off by default. Turn it on when your search is for outbound marketing and you want to exclude CVR records marked as advertising protected.",
        da: "'Spring virksomheder med marketingfravalg over' er slået fra som standard. Slå det til, når søgningen bruges til outbound marketing, og du vil udelukke CVR-poster markeret som reklamebeskyttede.",
      },
      callout: {
        kind: "warning",
        en: "This filter is a compliance aid, not legal advice. You are still responsible for checking whether your outreach is allowed for the channel and audience you use.",
        da: "Dette filter er en compliance-hjælp, ikke juridisk rådgivning. Du er stadig ansvarlig for at kontrollere, om din kontakt er tilladt for den kanal og målgruppe, du bruger.",
      },
    },
    {
      id: "segmentation",
      title: { en: "Segmentation filters", da: "Segmenteringsfiltre" },
      body: {
        en: "Revenue, gross profit, and employee maximum are app-side segmentation filters. CVR does not search those ranges directly in the company search endpoint, so CVR Mate first collects candidate companies with the native filters, then applies these ranges to the returned accounting and employment data.",
        da: "Omsætning, bruttofortjeneste og maksimum for medarbejdere er app-side segmenteringsfiltre. CVR søger ikke direkte på disse intervaller i company search-endpointet, så CVR Mate indsamler først kandidater med native filtre og anvender derefter intervallerne på de returnerede regnskabs- og medarbejderdata.",
      },
      features: {
        en: [
          "Revenue and gross profit ranges are entered in million DKK and matched against the latest available accounting summary.",
          "Employee segmentation uses the latest monthly employee count when available, otherwise the latest yearly count.",
          "For better coverage, combine segmentation with at least one native filter such as industry, location, company form, founded period, or employee minimum.",
        ],
        da: [
          "Omsætning og bruttofortjeneste angives i millioner DKK og matches mod det seneste tilgængelige regnskabsresumé.",
          "Medarbejdersegmentering bruger det seneste månedlige medarbejdertal, når det findes, ellers det seneste årlige tal.",
          "For bedre dækning bør segmentering kombineres med mindst ét native filter såsom branche, lokation, selskabsform, stiftelsesperiode eller medarbejderminimum.",
        ],
      },
      callout: {
        kind: "info",
        en: "If a company has no usable accounting or employment value for a selected segmentation range, it is excluded from that segmented result set.",
        da: "Hvis en virksomhed ikke har en brugbar regnskabs- eller medarbejderværdi for et valgt segmenteringsinterval, udelukkes den fra det segmenterede resultatsæt.",
      },
    },
    {
      id: "results-table",
      title: { en: "Results table", da: "Resultattabel" },
      body: {
        en: "Search results are displayed as a dense table with key data visible per row: company name, CVR number, city, industry, company form, employee count, and status. Results are rechecked against the active native filters before segmentation is applied.",
        da: "Søgeresultater vises som en kompakt tabel med nøgledata synlig pr. række: firmanavn, CVR-nummer, by, branche, selskabsform, medarbejderantal og status. Resultater kontrolleres igen mod de aktive native filtre, før segmentering anvendes.",
      },
      screenshot: {
        slug: "search/results-table",
        alt: { en: "Search results table", da: "Søgeresultattabel" },
      },
    },
    {
      id: "limits-and-coverage",
      title: { en: "Limits and coverage", da: "Grænser og dækning" },
      body: {
        en: "A search requires at least one real filter. Each search reserves one company-search quota unit before CVR is queried, and expensive search traffic is rate limited to 30 searches per minute per user. If rate-limit storage is unavailable, the search route fails closed instead of allowing unlimited fan-out.",
        da: "En søgning kræver mindst ét reelt filter. Hver søgning reserverer én virksomhedssøgnings-kvoteenhed, før CVR forespørges, og tung søgetrafik begrænses til 30 søgninger pr. minut pr. bruger. Hvis rate-limit-lageret ikke er tilgængeligt, fejler søgeruten lukket i stedet for at tillade ubegrænset fan-out.",
      },
      features: {
        en: [
          "CVR's company search endpoint returns a small batch per call, so CVR Mate expands coverage with controlled variation searches and deduplicates by CVR number.",
          "The result set can be marked as truncated when CVR returns full batches, which means more matching companies may exist than the table currently shows.",
          "Quota is reserved before upstream calls to prevent concurrent searches from bypassing monthly plan limits.",
        ],
        da: [
          "CVR's company search-endpoint returnerer et lille batch pr. kald, så CVR Mate udvider dækningen med kontrollerede variationssøgninger og deduplikerer på CVR-nummer.",
          "Resultatsættet kan markeres som afkortet, når CVR returnerer fulde batches, hvilket betyder, at der kan findes flere matchende virksomheder end tabellen viser.",
          "Kvote reserveres før upstream-kald for at forhindre samtidige søgninger i at omgå månedlige plangrænser.",
        ],
      },
      callout: {
        kind: "note",
        en: "Broader filters can still miss some companies because CVR does not expose full pagination for this endpoint. Use more specific native filters when you need a tighter, more reliable audience.",
        da: "Brede filtre kan stadig overse nogle virksomheder, fordi CVR ikke udstiller fuld paginering for dette endpoint. Brug mere specifikke native filtre, når du har brug for en smallere og mere pålidelig målgruppe.",
      },
    },
    {
      id: "save-search",
      title: { en: "Saving a search", da: "Gem en søgning" },
      body: {
        en: "Click 'Save search' above the results to name and store your current filter combination. Saved searches appear in the Saved Searches page and can be used as the basis for a Trigger.",
        da: "Klik på 'Gem søgning' over resultaterne for at navngive og gemme din nuværende filterkombination. Gemte søgninger vises på siden Gemte søgninger og kan bruges som grundlag for en Trigger.",
      },
    },
    {
      id: "export-from-search",
      title: { en: "Exporting results", da: "Eksportér resultater" },
      body: {
        en: "Click the Export button to download the current result set as a CSV or XLSX file. The export respects all active filters and includes all columns visible in the table.",
        da: "Klik på Eksportér-knappen for at downloade det aktuelle resultatsæt som en CSV- eller XLSX-fil. Eksporten respekterer alle aktive filtre og inkluderer alle kolonner synlige i tabellen.",
      },
      badge: "Pro",
    },
  ],
};
