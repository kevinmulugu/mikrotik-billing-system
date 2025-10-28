'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href: string | undefined;
}

export function Breadcrumbs() {
  const pathname = usePathname();

  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [{ label: 'Dashboard', href: '/dashboard' }];

    if (segments.length === 1 && segments[0] === 'dashboard') {
      return [];
    }

    let currentPath = '';
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;

      // Skip the dashboard segment as it's already included
      if (segment === 'dashboard') return;

      let label = segment.charAt(0).toUpperCase() + segment.slice(1);

      // Custom labels for better UX
      switch (segment) {
        case 'routers':
          label = 'Routers';
          break;
        case 'users':
          label = 'Users';
          break;
        case 'vouchers':
          label = 'Vouchers';
          break;
        case 'payments':
          label = 'Payments';
          break;
        case 'support':
          label = 'Support';
          break;
        case 'settings':
          label = 'Settings';
          break;
        case 'add':
          label = 'Add';
          break;
        case 'edit':
          label = 'Edit';
          break;
        case 'generate':
          label = 'Generate';
          break;
        case 'history':
          label = 'History';
          break;
        case 'analytics':
          label = 'Analytics';
          break;
        default:
          // If it's a UUID or ID, show it as is
          if (segment.match(/^[0-9a-f-]+$/i) || segment.match(/^\d+$/)) {
            label = `#${segment}`;
          }
      }

      breadcrumbs.push({
        label,
        href: index === segments.length - 1 ? undefined : currentPath,
      });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav className="flex" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-4">
        <li>
          <div>
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              <Home className="h-5 w-5 flex-shrink-0" />
              <span className="sr-only">Dashboard</span>
            </Link>
          </div>
        </li>
        {breadcrumbs.map((breadcrumb, index) => (
          <li key={breadcrumb.label}>
            <div className="flex items-center">
              <ChevronRight className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
              {breadcrumb.href ? (
                <Link
                  href={breadcrumb.href}
                  className="ml-4 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  {breadcrumb.label}
                </Link>
              ) : (
                <span className="ml-4 text-sm font-medium text-foreground">
                  {breadcrumb.label}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}