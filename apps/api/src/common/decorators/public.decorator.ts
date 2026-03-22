// APG Manager RMS - Decorator @Public() (đánh dấu route công khai)
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Dùng: @Public() trên controller/handler để bỏ qua JWT
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
