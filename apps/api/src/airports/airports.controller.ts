import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { AirportsService } from './airports.service';

@Controller('airports')
export class AirportsController {
  constructor(private readonly airportsService: AirportsService) {}

  /**
   * GET /airports/search?q=dxb&limit=10
   * Full-text search airports by IATA, ICAO, name, city
   */
  @Get('search')
  async search(
    @Query('q') q: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const results = await this.airportsService.search(q, Math.min(limit, 50));
    return { data: results, total: results.length };
  }

  /**
   * GET /airports/distance?origin=HAN&destination=DXB
   * Calculates haversine distance + transit suggestions
   */
  @Get('distance')
  async distance(
    @Query('origin') origin: string,
    @Query('destination') destination: string,
  ) {
    if (!origin || !destination) {
      return { error: 'origin and destination IATA codes are required' };
    }
    const result = await this.airportsService.calculateDistance(origin, destination);
    if (!result) {
      return { error: 'One or both airports not found. Make sure to seed the database first.' };
    }
    return { data: result };
  }
}
