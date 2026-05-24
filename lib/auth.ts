import GoogleProvider from 'next-auth/providers/google';
import type { NextAuthOptions } from 'next-auth';

const ALLOWED_EMAILS = (process.env.ADMIN_EMAILS || 'kyle@crbnpickleball.com').split(',').map(e => e.trim());

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (user.email && ALLOWED_EMAILS.includes(user.email)) {
        return true;
      }
      return '/admin/login?error=unauthorized';
    },
    async session({ session }) {
      return session;
    },
  },
  pages: {
    signIn: '/admin/login',
    error: '/admin/login',
  },
};
