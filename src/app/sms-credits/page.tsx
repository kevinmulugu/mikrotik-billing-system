// src/app/sms-credits/page.tsx
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { SMSCreditsContent } from './sms-credits-content';

export default async function SMSCreditsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  return <SMSCreditsContent />;
}
