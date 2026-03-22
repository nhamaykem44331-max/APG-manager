// APG Manager RMS - Flights Controller (Phase 2 stub)
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('flights')
@UseGuards(JwtAuthGuard)
export class FlightsController {
  // POST /flights/search - Tìm chuyến bay qua AbayEngine
  @Post('search')
  async search(@Body() body: { from: string; to: string; date: string; type?: string }) {
    // TODO Phase 2: gọi AbayEngine
    return {
      message: 'AbayEngine integration - Phase 2',
      params: body,
      results: [],
    };
  }

  // GET /flights/airports - Danh sách sân bay (autocomplete)
  @Get('airports')
  getAirports() {
    return VIETNAM_AIRPORTS;
  }
}

// Danh sách sân bay Việt Nam
const VIETNAM_AIRPORTS = [
  { code: 'HAN', name: 'Nội Bài', city: 'Hà Nội' },
  { code: 'SGN', name: 'Tân Sơn Nhất', city: 'Hồ Chí Minh' },
  { code: 'DAD', name: 'Đà Nẵng', city: 'Đà Nẵng' },
  { code: 'CXR', name: 'Cam Ranh', city: 'Nha Trang' },
  { code: 'PQC', name: 'Phú Quốc', city: 'Phú Quốc' },
  { code: 'HPH', name: 'Cát Bi', city: 'Hải Phòng' },
  { code: 'HUI', name: 'Phú Bài', city: 'Huế' },
  { code: 'VCA', name: 'Cần Thơ', city: 'Cần Thơ' },
  { code: 'UIH', name: 'Phù Cát', city: 'Quy Nhơn' },
  { code: 'VII', name: 'Vinh', city: 'Vinh' },
  { code: 'BMV', name: 'Buôn Ma Thuột', city: 'Buôn Ma Thuột' },
  { code: 'DLI', name: 'Liên Khương', city: 'Đà Lạt' },
  { code: 'VCL', name: 'Chu Lai', city: 'Tam Kỳ' },
  { code: 'VKG', name: 'Rạch Giá', city: 'Rạch Giá' },
  { code: 'CAH', name: 'Cà Mau', city: 'Cà Mau' },
  { code: 'TBB', name: 'Tuy Hòa', city: 'Tuy Hòa' },
  { code: 'DIN', name: 'Điện Biên', city: 'Điện Biên Phủ' },
  { code: 'PXU', name: 'Pleiku', city: 'Pleiku' },
  { code: 'VDH', name: 'Đồng Hới', city: 'Đồng Hới' },
  { code: 'THD', name: 'Thọ Xuân', city: 'Thanh Hóa' },
];
