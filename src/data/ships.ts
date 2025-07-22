export interface ship{
    id: string;
    lat: number;
    lon: number;
    heading: number;
    speed: number;
    lastUpdate: number;
    route: [number, number][];
}