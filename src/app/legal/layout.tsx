// src/app/legal/layout.tsx
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </Button>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {children}
      </div>
      <footer className="border-t mt-12">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-wrap gap-4 justify-center text-sm text-muted-foreground">
            <Link href="/legal/privacy-policy" className="hover:text-primary">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link href="/legal/terms-of-service" className="hover:text-primary">
              Terms of Service
            </Link>
            <span>•</span>
            <Link href="/legal/cookie-policy" className="hover:text-primary">
              Cookie Policy
            </Link>
            <span>•</span>
            <Link href="/legal/acceptable-use" className="hover:text-primary">
              Acceptable Use Policy
            </Link>
            <span>•</span>
            <Link href="/legal/sla" className="hover:text-primary">
              Service Level Agreement
            </Link>
          </div>
          <div className="text-center mt-4 text-sm text-muted-foreground">
            © {new Date().getFullYear()} PAY N BROWSE. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
