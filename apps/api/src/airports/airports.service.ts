// airports.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

export interface DistanceResult {
  originIata: string;
  destinationIata: string;
  distanceKm: number;
  estimatedFlightHours: number;
  transitSuggestions: TransitSuggestion[];
}

export interface TransitSuggestion {
  hub: string;
  route: string;
  leg1Km: number;
  leg2Km: number;
}

const MAJOR_HUBS = [
  { iata: 'DXB', lat: 25.2528, lng: 55.3644 }, // Dubai
  { iata: 'SIN', lat: 1.3644, lng: 103.9915 },  // Singapore
  { iata: 'HKG', lat: 22.3089, lng: 113.9147 }, // Hong Kong
  { iata: 'BKK', lat: 13.6811, lng: 100.7475 }, // Bangkok
  { iata: 'IST', lat: 41.2750, lng: 28.7519 },  // Istanbul
  { iata: 'DOH', lat: 25.2609, lng: 51.6138 },  // Doha
  { iata: 'AMS', lat: 52.3086, lng: 4.7639 },   // Amsterdam
  { iata: 'FRA', lat: 50.0379, lng: 8.5622 },   // Frankfurt
  { iata: 'NRT', lat: 35.7647, lng: 140.3864 }, // Tokyo Narita
  { iata: 'ICN', lat: 37.4600, lng: 126.4407 }, // Seoul
];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.asin(Math.sqrt(a)));
}

@Injectable()
export class AirportsService {
  constructor(private prisma: PrismaService) {}

  // ===== Cách 2: Search airports with full-text search =====
  async search(q: string, limit = 10) {
    if (!q || q.length < 1) return [];
    
    const query = q.trim().toUpperCase();
    const queryLower = q.trim().toLowerCase();

    // Try exact IATA first (fastest)
    if (query.length === 3) {
      const exact = await this.prisma.airport.findUnique({
        where: { iata: query },
      });
      if (exact) return [exact];
    }

    return this.prisma.airport.findMany({
      where: {
        OR: [
          { iata: { startsWith: query } },
          { icao: { startsWith: query } },
          { name: { contains: queryLower, mode: 'insensitive' } },
          { nameVi: { contains: queryLower, mode: 'insensitive' } },
          { region: { contains: queryLower, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: [
        // Prioritize: IATA match > Vietnamese names > others
        { iata: 'asc' },
      ],
    });
  }

  // ===== Cách 3: Calculate distance and transit suggestions =====
  async calculateDistance(originIata: string, destinationIata: string): Promise<DistanceResult | null> {
    const [origin, dest] = await Promise.all([
      this.prisma.airport.findUnique({ where: { iata: originIata.toUpperCase() } }),
      this.prisma.airport.findUnique({ where: { iata: destinationIata.toUpperCase() } }),
    ]);

    if (!origin || !dest) return null;

    const distanceKm = haversineKm(origin.latitude, origin.longitude, dest.latitude, dest.longitude);
    const estimatedFlightHours = Math.round((distanceKm / 850) * 10) / 10;

    // Build transit suggestions for long-haul routes (>5000km)
    const transitSuggestions: TransitSuggestion[] = [];
    if (distanceKm > 5000) {
      const hubsSorted = MAJOR_HUBS
        .map((hub) => {
          const leg1 = haversineKm(origin.latitude, origin.longitude, hub.lat, hub.lng);
          const leg2 = haversineKm(hub.lat, hub.lng, dest.latitude, dest.longitude);
          // Only suggest if hub is "on the way" (combined legs not too much longer than direct)
          const ratio = (leg1 + leg2) / distanceKm;
          return { ...hub, leg1, leg2, ratio };
        })
        .filter((h) => h.ratio < 1.4) // max 40% detour
        .sort((a, b) => a.ratio - b.ratio)
        .slice(0, 3);

      for (const hub of hubsSorted) {
        transitSuggestions.push({
          hub: hub.iata,
          route: `${origin.iata} → ${hub.iata} → ${dest.iata}`,
          leg1Km: hub.leg1,
          leg2Km: hub.leg2,
        });
      }
    }

    return {
      originIata: origin.iata,
      destinationIata: dest.iata,
      distanceKm,
      estimatedFlightHours,
      transitSuggestions,
    };
  }
}
