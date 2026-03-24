'use client';

import { useState, useEffect, useRef } from 'react';

export interface Airport {
  iata: string;
  icao: string;
  name: string;
  region: string;
  country: string;
  lat: number;
  lng: number;
}

// Module-level cache: load once, reuse across all hook instances
let airportCache: Airport[] | null = null;
let loadingPromise: Promise<Airport[]> | null = null;

async function loadAirports(): Promise<Airport[]> {
  if (airportCache) return airportCache;
  if (loadingPromise) return loadingPromise;

  loadingPromise = fetch('/airports.json')
    .then((res) => res.json())
    .then((data: Airport[]) => {
      airportCache = data;
      return data;
    });

  return loadingPromise;
}

export function useAirportSearch(query: string, limit = 10) {
  const [results, setResults] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query || query.length < 1) {
      setResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const airports = await loadAirports();
        const q = query.toUpperCase().trim();
        const qLower = query.toLowerCase().trim();

        const filtered = airports
          .filter((a) => {
            return (
              a.iata.startsWith(q) ||
              a.icao?.startsWith(q) ||
              a.name.toLowerCase().includes(qLower) ||
              a.region.toLowerCase().includes(qLower)
            );
          })
          .slice(0, limit);

        setResults(filtered);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, limit]);

  return { results, loading };
}

// Utility: get single airport by IATA
export async function getAirportByIata(iata: string): Promise<Airport | null> {
  const airports = await loadAirports();
  return airports.find((a) => a.iata === iata.toUpperCase()) ?? null;
}

// Haversine distance between 2 airports (km)
export function haversineKm(a: Airport, b: Airport): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sin_dLat = Math.sin(dLat / 2);
  const sin_dLng = Math.sin(dLng / 2);
  const c =
    2 *
    Math.asin(
      Math.sqrt(
        sin_dLat * sin_dLat +
          Math.cos((a.lat * Math.PI) / 180) *
            Math.cos((b.lat * Math.PI) / 180) *
            sin_dLng * sin_dLng,
      ),
    );
  return Math.round(R * c);
}

// Utility: lấy tên sân bay từ IATA code (synchronous lookup từ cache)
export function getAirportName(iata: string): string {
  if (!iata) return '';
  const upper = iata.toUpperCase();
  if (!airportCache) {
    // Trigger load nếu chưa có cache
    loadAirports();
    return upper;
  }
  const airport = airportCache.find((a) => a.iata === upper);
  return airport?.name?.replace(/International Airport|Airport/gi, '').trim() ?? upper;
}

