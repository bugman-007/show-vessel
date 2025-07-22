export interface ship {
  id: string;
  lat: number;
  lon: number;
  heading: number;
  speed: number;
  lastUpdate: number;
  route: [number, number][];
}

export function useMockShips(): ship[] {
  return [
    {
      id: "ship1",
      lat: 13,
      lon: 67,
      heading: 180,
      speed: 10,
      route: [],
      lastUpdate: Date.now(),
    },
    {
      id: "ship2",
      lat: 17,
      lon: 65,
      heading: 270,
      speed: 12,
      route: [],
      lastUpdate: Date.now(),
    },
    {
      id: "ship3",
      lat: 26,
      lon: 53,
      heading: 45,
      speed: 18,
      route: [],
      lastUpdate: Date.now(),
    },
    {
      id: "ship4",
      lat: 5,
      lon: 80,
      heading: 135,
      speed: 20,
      route: [],
      lastUpdate: Date.now(),
    },
  ];
}
