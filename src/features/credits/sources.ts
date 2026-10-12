/** Where the borders of a country come from, and under what terms they are reused. */
export interface Source {
  /** The countries it is used for, as the game is written about them: in English. */
  countries: string
  /** Who made the data. */
  author: string
  /** Who republishes it, when it was not taken from its author. */
  via?: string
  licence: string
  url: string
}

/**
 * The sources of the borders the game is played on (api, `scripts/fetch-countries.ts`),
 * each to be credited. Kept beside that script: a country added there is added here.
 */
export const SOURCES: readonly Source[] = [
  {
    countries: 'Italy',
    author: 'ISTAT, as prepared by openpolis',
    licence: 'CC BY 4.0',
    url: 'https://github.com/openpolis/geojson-italy',
  },
  {
    countries: 'Switzerland',
    author: 'swisstopo, swissBOUNDARIES3D',
    via: 'Opendatasoft',
    licence: 'Opendata.swiss BY-ASK',
    url: 'https://www.swisstopo.admin.ch/en/landscape-model-swissboundaries3d',
  },
  {
    countries: 'France',
    author: 'IGN, ADMIN EXPRESS',
    via: 'Etalab',
    licence: 'Licence Ouverte 2.0',
    url: 'https://github.com/etalab/contours-administratifs',
  },
  {
    countries: 'United Kingdom',
    author: 'Office for National Statistics, Open Geography',
    via: 'Opendatasoft',
    licence: 'Open Government Licence v3.0',
    url: 'https://geoportal.statistics.gov.uk',
  },
  {
    countries: 'Denmark',
    author: 'Klimadatastyrelsen, DAGI',
    via: 'github.com/Neogeografen/dagi',
    licence: 'Danish free public geodata',
    url: 'https://dataforsyningen.dk',
  },
  {
    countries: 'Norway',
    author: 'Kartverket',
    via: 'github.com/robhop/fylker-og-kommuner',
    licence: 'CC BY 4.0',
    url: 'https://kartkatalog.geonorge.no',
  },
  {
    countries: 'Svalbard and Jan Mayen; the coast of Greenland',
    author: 'Natural Earth',
    licence: 'Public domain',
    url: 'https://www.naturalearthdata.com',
  },
  {
    countries: 'Faroe Islands, Iceland, Greenland (municipalities and settlements)',
    author: '© OpenStreetMap contributors',
    licence: 'ODbL 1.0',
    url: 'https://www.openstreetmap.org/copyright',
  },
  {
    countries: 'Sweden',
    author: 'Lantmäteriet',
    via: 'Opendatasoft',
    licence: 'CC0 1.0',
    url: 'https://www.lantmateriet.se',
  },
  {
    countries: 'Finland',
    author: 'Statistics Finland',
    licence: 'CC BY 4.0',
    url: 'https://www.stat.fi/org/avoindata/paikkatietoaineistot_en.html',
  },
  {
    countries: 'Germany',
    author: '© GeoBasis-DE / BKG',
    via: 'Opendatasoft',
    licence: 'Data licence Germany – attribution – version 2.0',
    url: 'https://www.govdata.de/dl-de/by-2-0',
  },
  {
    countries: 'Belgium',
    author: 'National Geographic Institute (NGI/IGN)',
    via: 'Opendatasoft',
    licence: 'NGI standard open licence',
    url: 'https://www.ngi.be',
  },
  {
    countries: 'Netherlands',
    author: 'CBS and Kadaster',
    via: 'Opendatasoft',
    licence: 'CC0 1.0',
    url: 'https://www.cbs.nl',
  },
  {
    countries: 'Spain',
    author: 'Instituto Geográfico Nacional',
    via: 'Opendatasoft',
    licence: 'CC BY 4.0',
    url: 'https://www.ign.es',
  },
  {
    countries: 'Portugal',
    author: 'Direção-Geral do Território',
    via: 'Opendatasoft',
    licence: 'Public domain',
    url: 'https://www.dgterritorio.gov.pt',
  },
  {
    countries: 'United States',
    author: 'U.S. Census Bureau',
    via: 'Opendatasoft',
    licence: 'Public domain',
    url: 'https://www.census.gov/geographies/mapping-files.html',
  },
  {
    countries: 'Canada',
    author: 'Statistics Canada',
    via: 'geoBoundaries and Opendatasoft',
    licence: 'Statistics Canada Open Licence',
    url: 'https://www.statcan.gc.ca/en/reference/licence',
  },
  {
    countries: 'Mexico',
    author: 'INEGI',
    via: 'Opendatasoft',
    licence: 'Free use of information from INEGI',
    url: 'https://www.inegi.org.mx',
  },
  {
    countries:
      'Austria, Ireland, Poland, Luxembourg, Andorra, Liechtenstein, San Marino, Monaco, Vatican City, Estonia, Latvia, Lithuania, Belarus, Ukraine, Moldova, Czechia, Slovakia, Hungary, Romania, Bulgaria, Slovenia, Croatia, Bosnia and Herzegovina, Serbia, Montenegro, Kosovo, North Macedonia, Albania, Greece, Russia, Turkey, Cyprus, Malta',
    author:
      'geoBoundaries (Runfola et al., 2020), from national agencies, OpenStreetMap contributors and public domain maps',
    licence: 'CC BY 4.0, ODbL 1.0, CC BY-SA or public domain, country by country',
    url: 'https://www.geoboundaries.org',
  },
  {
    countries: 'Czechia, Slovakia, Hungary (names of the municipalities)',
    author: 'Eurostat, GISCO: local administrative units 2024',
    licence: '© European Union, © EuroGeographics',
    url: 'https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units/local-administrative-units',
  },
  {
    countries: 'The map under every country',
    author: '© OpenStreetMap contributors',
    licence: 'ODbL 1.0',
    url: 'https://www.openstreetmap.org/copyright',
  },
]
