// APG Manager RMS - Root page redirect
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export default async function RootPage() {
  const session = await auth();

  if (session) {
    redirect('/dashboard');
  } else {
    redirect('/auth/login');
  }
}
