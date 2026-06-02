export type Tone = "green" | "amber" | "red";

export type Neighborhood = {
  id: string;
  rank: number;
  name: string;
  tone: Tone;
  drive: number;
  transit: number;
  transfers: number;
  walkability: number;
  vibe: string;
  safety: number;
  amenities: number;
  schools: number;
  summary: string;
  coordinates: [number, number];
};

export const WORKPLACE: [number, number] = [-118.255, 34.049];

export const colors: Record<Tone, string> = {
  green: "#4f9d52",
  amber: "#f3a428",
  red: "#d84f3f",
};

export const neighborhoods: Neighborhood[] = [
  {
    id: "highland-park",
    rank: 1,
    name: "Highland Park",
    tone: "green",
    drive: 18,
    transit: 24,
    transfers: 1,
    walkability: 72,
    vibe: "A-",
    safety: 78,
    amenities: 65,
    schools: 68,
    summary:
      "A strong balance of short drive times, reliable transit, and walkable amenities near parks and local shops.",
    coordinates: [-118.191, 34.112],
  },
  {
    id: "culver-city",
    rank: 2,
    name: "Culver City",
    tone: "amber",
    drive: 26,
    transit: 31,
    transfers: 1,
    walkability: 65,
    vibe: "B+",
    safety: 74,
    amenities: 72,
    schools: 70,
    summary:
      "A balanced option for restaurants, office access, and transit coverage with a moderate peak commute.",
    coordinates: [-118.374, 34.019],
  },
  {
    id: "silver-lake",
    rank: 3,
    name: "Silver Lake",
    tone: "amber",
    drive: 31,
    transit: 34,
    transfers: 1,
    walkability: 68,
    vibe: "B+",
    safety: 69,
    amenities: 70,
    schools: 63,
    summary:
      "High lifestyle appeal and strong neighborhood energy, with commute times landing in the moderate range.",
    coordinates: [-118.276, 34.086],
  },
  {
    id: "inglewood",
    rank: 4,
    name: "Inglewood",
    tone: "red",
    drive: 42,
    transit: 49,
    transfers: 2,
    walkability: 55,
    vibe: "B",
    safety: 62,
    amenities: 58,
    schools: 60,
    summary:
      "More reachable rents and useful amenities, but the peak commute is meaningfully longer.",
    coordinates: [-118.337, 33.961],
  },
];

export const listings = [
  { rent: "$2,350", meta: "2 bd - 1 ba - 810 sqft", address: "542 N Ave 53" },
  {
    rent: "$2,100",
    meta: "1 bd - 1 ba - 640 sqft",
    address: "120 Marmion Way",
  },
  { rent: "$2,650", meta: "2 bd - 2 ba - 950 sqft", address: "6043 York Blvd" },
];

export const fallbackPositions: Record<string, [number, number]> = {
  "highland-park": [552, 176],
  "culver-city": [195, 435],
  "silver-lake": [278, 270],
  inglewood: [435, 570],
};
