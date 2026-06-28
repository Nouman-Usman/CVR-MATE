/**
 * Secondary Industry Classification (6-digit NACE codes)
 * Common Danish secondary codes for reference-by-search in the library modal.
 * Format: code (6 digits) + Danish description
 */

export interface SecondaryNaceCode {
  code: string;
  label: string;
}

export const SECONDARY_NACE_CODES: SecondaryNaceCode[] = [
  // IT & Software (62)
  { code: "621000", label: "Computerprogrammering" },
  { code: "621100", label: "Analyse og design af computersystemer" },
  { code: "621200", label: "Systemadministration og hosting" },
  { code: "622000", label: "Computerkonsulenttjeneste" },
  { code: "622100", label: "It-konsulency" },
  { code: "622200", label: "It-systemledelse" },
  { code: "623000", label: "Computerfaciliteter management" },
  { code: "623100", label: "Datacenter-drift" },
  { code: "624000", label: "Anden it-tjenesteydervirksomhed" },
  { code: "625100", label: "Vedligeholdelse og reparation af computere" },
  { code: "626000", label: "Andet med forbindelse til it" },
  { code: "629000", label: "Andre IT- og computerserviceaktiviteter" },
  { code: "582900", label: "Anden udgivelse af software" },

  // Telecommunication (61)
  { code: "611000", label: "Virksomhedstelekommunikation" },
  { code: "612000", label: "Trådløs telekommunikation" },
  { code: "613000", label: "Satellittelekommunikation" },
  { code: "619000", label: "Anden telekommunikation" },

  // Financial Services (64)
  { code: "641100", label: "Centralbank" },
  { code: "641200", label: "Anden kredit og udlån" },
  { code: "641900", label: "Anden pengeudlånsvirksomhed" },
  { code: "642000", label: "Finansiel leasing" },
  { code: "649100", label: "Finansiering af handel" },
  { code: "649200", label: "Andre finansieringsvirksomheder" },

  // Insurance & Pension (65-66)
  { code: "651100", label: "Livsforsikring" },
  { code: "651200", label: "Anden forsikring end livsforsikring" },
  { code: "652000", label: "Genforsikring" },
  { code: "661100", label: "Administration af pensionsfonde" },
  { code: "661200", label: "Anden virksomhed inden for pension og sociale forsikringer" },

  // Utilities (35-36)
  { code: "351000", label: "Elproduktion" },
  { code: "352000", label: "Eldistribution" },
  { code: "353100", label: "Vandberedning" },
  { code: "353200", label: "Vandforsyning" },
  { code: "360000", label: "Sanitet og affaldshåndtering" },

  // Construction (41-43)
  { code: "411000", label: "Forberedelse af byggeplads" },
  { code: "412100", label: "Bygning af beboelhuse" },
  { code: "412200", label: "Bygning af ikke-beboelseshuse" },
  { code: "412300", label: "Bygning af beboelses- og ikke-beboelseshuse" },
  { code: "421000", label: "Anlægsarbejde for veje og jernbaner" },
  { code: "422000", label: "Anlægsarbejde for vandingenørarbejder" },
  { code: "429900", label: "Øvrigt anlægsarbejde" },
  { code: "431100", label: "Nedrivningsarbejde" },
  { code: "431200", label: "Forberedelse af byggeplads" },
  { code: "431300", label: "Testning og analyse af byggeplads" },
  { code: "432100", label: "Elektrisk installationsarbejde" },
  { code: "432200", label: "Rør- og ventilationsarbejde" },
  { code: "432300", label: "Andet specialiseret byggeri og installationsarbejde" },
  { code: "432400", label: "Isolering og vandtætning" },
  { code: "432900", label: "Andet arbejde med forbindelse til byggeri" },

  // Wholesale Trade (46)
  { code: "461100", label: "Engroshandel med råmaterialer til landbrug" },
  { code: "461200", label: "Engroshandel med levende dyr" },
  { code: "461300", label: "Engroshandel med animalske biprodukter" },
  { code: "461700", label: "Engroshandel med korn, frø og foder" },
  { code: "461800", label: "Engroshandel med blomster og plantestof" },
  { code: "461900", label: "Engroshandel med andre råmaterialer, landbrugsprodukter" },
  { code: "462100", label: "Engroshandel med kød og kødprodukter" },
  { code: "462200", label: "Engroshandel med fisk, fiskeriprodukter og dengang" },
  { code: "462300", label: "Engroshandel med frugt, grønsager og kartofler" },
  { code: "462400", label: "Engroshandel med vegetabilske olier og fede" },
  { code: "462500", label: "Engroshandel med mejeriprodukter, æg og spiselige olier" },
  { code: "462600", label: "Engroshandel med korn, mel og stivelse" },
  { code: "462700", label: "Engroshandel med kaffe, te, kakao og krydderier" },
  { code: "462800", label: "Engroshandel med sukker, konfektørvarer og desserter" },
  { code: "462900", label: "Engroshandel med andre fødevarer" },
  { code: "463100", label: "Engroshandel med frugt- og grøntsagssaft" },
  { code: "463200", label: "Engroshandel med øl og drikke" },
  { code: "463300", label: "Engroshandel med tobak og tobaksvarer" },
  { code: "464100", label: "Engroshandel med tekstilvarer" },
  { code: "464200", label: "Engroshandel med beklædning og fodtøj" },
  { code: "464300", label: "Engroshandel med medicinsk- og kirurgisk- udstyr og tilbehør" },
  { code: "464400", label: "Engroshandel med parfumer og kosmetik" },
  { code: "464500", label: "Engroshandel med farmaceutiske varer" },
  { code: "464600", label: "Engroshandel med møbler, belysningsudstyr og andre boligartikler" },
  { code: "464700", label: "Engroshandel med elektronik og elmateriell" },
  { code: "464800", label: "Engroshandel med diverse specialiserede artikler" },
  { code: "464900", label: "Engroshandel med andre specialiserede artikler" },
  { code: "465100", label: "Engroshandel med biler og motorkøretøjer" },
  { code: "465200", label: "Engroshandel med bildele og motorkøretøjsdele" },
  { code: "465300", label: "Engroshandel med motorcykler og motorcykeldele" },
  { code: "466000", label: "Engroshandel med andre konsumgoder" },
  { code: "469110", label: "Engroshandel på kommission, fødevarer" },
  { code: "469120", label: "Engroshandel på kommission, tekstilvarer og beklædning" },
  { code: "469190", label: "Engroshandel på kommission, andre artikler" },
  { code: "469200", label: "Engroshandel uden fast opholdssted" },

  // Retail Trade (47)
  { code: "471100", label: "Supermarkeder" },
  { code: "471200", label: "Andet detailhandel med fødevarer i specialiserede butikker" },
  { code: "472100", label: "Detailhandel med frugt og grønsager" },
  { code: "472200", label: "Detailhandel med kød og kødprodukter" },
  { code: "472300", label: "Detailhandel med fisk og fiskeriprodukter" },
  { code: "472400", label: "Detailhandel med brød, kagekager og konditorivarer" },
  { code: "472500", label: "Detailhandel med drikke" },
  { code: "472600", label: "Detailhandel med tobak og tobaksvarer" },
  { code: "473100", label: "Detailhandel med biler og motorkøretøjer" },
  { code: "473200", label: "Detailhandel med motorkøretøjsdele og tilbehør" },
  { code: "473300", label: "Detailhandel med benzin" },
  { code: "474100", label: "Detailhandel med computerudstyr og software" },
  { code: "474200", label: "Detailhandel med telekommunikationsudsty" },
  { code: "474300", label: "Detailhandel med elektronik" },
  { code: "474400", label: "Detailhandel med elektrisk husholdningsudstyr" },
  { code: "475100", label: "Detailhandel med møbler, belysningsudstyr og anden boligudstyr" },
  { code: "475200", label: "Detailhandel med være til boligindretning" },
  { code: "475300", label: "Detailhandel med biler, musikinstrumenter og hobbyudstyr" },
  { code: "476100", label: "Detailhandel med bøger, blade og aviser" },
  { code: "476200", label: "Detailhandel med musik og film på bånd og disk" },
  { code: "477100", label: "Detailhandel med beklædning" },
  { code: "477200", label: "Detailhandel med fodtøj og lædersvarer" },
  { code: "478100", label: "Detailhandel med medicin og apotek" },
  { code: "478200", label: "Detailhandel med medicinsk- og ortopædisk udstyr" },
  { code: "478300", label: "Detailhandel med kosmetik og toiletartikler" },
  { code: "479100", label: "Detailhandel med biler, møbler og andet" },
  { code: "479900", label: "Øvrig detailhandel uden for butik eller marked" },

  // Transportation & Logistics (49-52)
  { code: "491100", label: "Personbefordring med bus og minibus" },
  { code: "491200", label: "Taxa og buskørsel" },
  { code: "492110", label: "Godstransport på vej" },
  { code: "492900", label: "Anden virksomhed inden for vejtransport" },
  { code: "501000", label: "Søtransport af passagerer" },
  { code: "502000", label: "Søtransport af gods" },
  { code: "503100", label: "Indre vandvejstransport af passagerer" },
  { code: "503200", label: "Indre vandvejstransport af gods" },
  { code: "511010", label: "Lufttransport af passagerer" },
  { code: "511020", label: "Lufttransport af gods" },
  { code: "512100", label: "Rumtransport" },
  { code: "521100", label: "Lagring og opbevaring af gods" },
  { code: "521200", label: "Parcel distribution" },
  { code: "522000", label: "Støtte til landtransport" },
  { code: "523000", label: "Støtte til søtransport" },
  { code: "524100", label: "Havneaktiviteter" },
  { code: "524200", label: "Lastningsaktiviteter" },
  { code: "525100", label: "Spedition" },
  { code: "525200", label: "Andre transportagenturer" },

  // Accommodation & Food Service (55-56)
  { code: "551010", label: "Hotels og motel" },
  { code: "551020", label: "Feriepensionater" },
  { code: "551030", label: "Seminarhoteller" },
  { code: "552100", label: "Ferielejligheder og sommerhuse" },
  { code: "552200", label: "Campingtplasser" },
  { code: "552300", label: "Andet indkvarteringssted" },
  { code: "561010", label: "Restauranter" },
  { code: "561020", label: "Cafeer og småkagekafeer" },
  { code: "561040", label: "Catering" },
  { code: "562100", label: "Barers drift" },
  { code: "562900", label: "Anden drift med forbindelse til drikkebeværtning" },

  // Professional & Technical Services (69-74)
  { code: "691100", label: "Advokatvirksomhed" },
  { code: "691200", label: "Notarvirksomhed" },
  { code: "692000", label: "Regnskabs-, bogholderi- og revisorvirksomhed" },
  { code: "701100", label: "Ejendomsmæglervirksomhed" },
  { code: "701200", label: "Ejendomsvurdering" },
  { code: "702000", label: "Anden virksomhed inden for ejendomme" },
  { code: "711000", label: "Arkitekt- og ingeniørvirksomhed" },
  { code: "712000", label: "Teknisk konsulentvirksomhed" },
  { code: "721100", label: "Forskning og udvikling inden for naturvidenskab" },
  { code: "721200", label: "Forskning og udvikling inden for teknik og teknologi" },
  { code: "722000", label: "Forskning og udvikling inden for samfundsvidenskab og humanistik" },
  { code: "731100", label: "Reklamevirksomhed" },
  { code: "731200", label: "Markedsundersøgelser og meningsmålinger" },
  { code: "732100", label: "Design" },
  { code: "732200", label: "Fotografering" },
  { code: "732300", label: "Oversættelses- og tolkningsvirksomhed" },
  { code: "741000", label: "Specialiseret virksomhed til specifikke formål" },
  { code: "742000", label: "Anden erhvervsmæssig virksomhed" },
  { code: "749000", label: "Anden professionel, videnskabelig og teknisk virksomhed" },

  // Administrative & Support Services (77-82)
  { code: "771100", label: "Udlejning af biler uden chauffør" },
  { code: "771200", label: "Udlejning af andre køretøjer" },
  { code: "772000", label: "Udlejning af genstande til privatforbrug" },
  { code: "773100", label: "Udlejning af jordbrugsmaskiner og -udsyr" },
  { code: "773200", label: "Udlejning af bygge- og byggeudsyr" },
  { code: "773300", label: "Udlejning af andet maskine- og udstyr" },
  { code: "774100", label: "Leasing af intellektuel ejendomsret" },
  { code: "774200", label: "Udlejning af andet immateriell aktiver" },
  { code: "781000", label: "Ansættelse af fast arbejdskraft" },
  { code: "782000", label: "Ansættelse af fast arbejdskraft på midlertidig basis" },
  { code: "790000", label: "Andre virksomheder med forbindelse til beskæftigelse" },
  { code: "801000", label: "Privat sikkerhedsvirksomhed" },
  { code: "802000", label: "Sikkerhedsudstyr og anden sikkerhedsbetjening" },
  { code: "811100", label: "Kombineret facility management" },
  { code: "811200", label: "Renhold af bygninger og andet" },
  { code: "812000", label: "Rengørings- og sanering af affald" },
  { code: "821000", label: "Kontorfunktioner og dertil hørende virksomhed" },
  { code: "822000", label: "Virksomhed med forbindelse til telefon-centraler" },

  // Education (85)
  { code: "851000", label: "Forhåndsuniversitets-uddannelser" },
  { code: "852000", label: "Universitets- og videregånde uddannelse" },
  { code: "853000", label: "Erhvervsfaglig uddannelse og anden undervisning" },
  { code: "854100", label: "Sportsundervisning" },
  { code: "854200", label: "Kulturel og kunstnerisk uddannelse" },
  { code: "855000", label: "Andet undervisningsforhold" },
  { code: "856000", label: "Uddannelse- og undervisningsformidling" },

  // Healthcare (86-87)
  { code: "861000", label: "Hospitalsvirksomhed" },
  { code: "862100", label: "Praktiserende læger" },
  { code: "862200", label: "Tandlægevirksomhed" },
  { code: "862300", label: "Dyrlægevirksomhed" },
  { code: "862900", label: "Anden praksis inden for sundhedsvæsen" },
  { code: "869100", label: "Ambulancevirksomhed" },
  { code: "869200", label: "Anden virksomhed inden for sundhedsvæsen" },
  { code: "871000", label: "Plejehjemsdrift" },
  { code: "872000", label: "Daghjemsdrift for ældre" },
  { code: "873100", label: "Socialvejledning" },
  { code: "873200", label: "Virksomhed med forbindelse til adoption og børnebeskyttelse" },
  { code: "879000", label: "Anden social arbejdsindsats" },

  // Arts & Entertainment (90-93)
  { code: "900100", label: "Udøvende kunstnere inden for musik" },
  { code: "900200", label: "Udøvende kunstnere inden for dans og teater" },
  { code: "901000", label: "Kunstmusik- og andre kunstneriske opførelser" },
  { code: "902000", label: "Drift af kunstsamlinger, museer og arkiver" },
  { code: "903000", label: "Virksomhed med forbindelse til formidling af kunstner" },
  { code: "910000", label: "Biblioteks- og arkivvirksomhed" },
  { code: "920000", label: "Spil og væddemål" },
  { code: "931000", label: "Idrætsklubber og idrætsforening" },
  { code: "932000", label: "Anden idrætsvirksomhed" },
  { code: "933000", label: "Anden underholdningsvirksomhed" },
];

export const searchSecondaryNaceCodes = (query: string): SecondaryNaceCode[] => {
  if (!query.trim()) return SECONDARY_NACE_CODES;

  const lowerQuery = query.toLowerCase();
  return SECONDARY_NACE_CODES.filter(
    (code) =>
      code.code.includes(query) ||
      code.label.toLowerCase().includes(lowerQuery)
  );
};
