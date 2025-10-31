// types/next-auth.d.ts
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    id: string;
    role?: string;
    unreadNotifications?: number;
  }

  interface Session {
    user: {
      paymentMethod: string;
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      unreadNotifications?: number;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string;
    sub?: string;
    name?: string | null;
    email?: string | null;
    picture?: string | null;
  }
}