import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { KnowledgeBase } from '@/components/support/knowledge-base';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Knowledge Base - MikroTik Billing',
  description: 'Find answers to common questions and helpful guides',
};

export default async function KnowledgeBasePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <a href="/support">
            <ArrowLeft className="h-4 w-4" />
          </a>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Knowledge Base</h1>
          <p className="text-muted-foreground mt-1">
            Find answers to common questions and step-by-step guides
          </p>
        </div>
      </div>

      {/* Knowledge Base Component */}
      <KnowledgeBase />
    </div>
  );
}