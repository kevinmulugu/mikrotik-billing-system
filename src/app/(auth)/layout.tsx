import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Logo/Brand Header */}
      <div className="absolute top-4 left-4 sm:top-8 sm:left-8">
        <a href="/" className="flex items-center space-x-2">
          <div className="bg-blue-600 w-8 h-8 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">MB</span>
          </div>
          <span className="font-semibold text-gray-900 hidden sm:block">
            MikroTik Billing
          </span>
        </a>
      </div>

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
        <p className="text-xs text-gray-500 text-center">
          © 2025 MikroTik Billing. All rights reserved.
        </p>
      </footer>
    </div>
  );
}