declare module 'geoip-lite' {
  interface GeoIpLookupInfo {
    range: [number, number];
    country: string;
    region: string;
    eu: '1' | '0';
    timezone: string;
    city: string;
    ll: [number, number]; // latitude, longitude
    metro: number;
    area: number;
  }

  function lookup(ip: string): GeoIpLookupInfo | null;
  function pretty(ip: string): string;
  function startWatchingDataUpdate(): void;
  function stopWatchingDataUpdate(): void;
  function reloadDataSync(): void;
  function reload(callback: (err: Error) => void): void;

  export = {
    lookup,
    pretty,
    startWatchingDataUpdate,
    stopWatchingDataUpdate,
    reloadDataSync,
    reload
  };
}