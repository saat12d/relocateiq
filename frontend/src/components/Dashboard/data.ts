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
