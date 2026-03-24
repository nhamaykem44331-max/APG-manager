import { redirect } from 'next/navigation';

export default function DeprecatedNewBookingPage() {
  redirect('/bookings');
}
