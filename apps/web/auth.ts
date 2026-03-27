// APG Manager RMS - NextAuth v5 Configuration
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',     type: 'email' },
        password: { label: 'Mật khẩu', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email:    credentials.email,
              password: credentials.password,
            }),
          });

          if (!res.ok) {
            console.error('Login failed:', res.status, await res.text());
            return null;
          }

          const data = await res.json() as {
            accessToken:  string;
            refreshToken: string;
            user: { id: string; email: string; fullName: string; role: string };
          };

          return {
            id:           data.user.id,
            email:        data.user.email,
            name:         data.user.fullName,
            role:         data.user.role,
            accessToken:  data.accessToken,
            refreshToken: data.refreshToken,
          };
        } catch (e) {
          console.error('Auth error:', e);
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id           = user.id;
        token.role         = (user as { role: string }).role;
        token.accessToken  = (user as { accessToken: string }).accessToken;
        token.refreshToken = (user as { refreshToken: string }).refreshToken;
        token.name         = user.name;
        token.email        = user.email;
      }

      if (trigger === 'update' && session) {
        const updatedUser = 'user' in session && session.user ? session.user : session;
        token.name = (updatedUser as { name?: string | null }).name ?? token.name;
        token.email = (updatedUser as { email?: string | null }).email ?? token.email;
        token.role = (updatedUser as { role?: string }).role ?? token.role;
        token.accessToken = (updatedUser as { accessToken?: string }).accessToken ?? token.accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id          = token.id as string;
        session.user.name        = (token.name as string | undefined) ?? session.user.name;
        session.user.email       = (token.email as string | undefined) ?? session.user.email;
        session.user.role        = token.role as string;
        session.user.accessToken = token.accessToken as string;
      }
      return session;
    },
  },

  pages: {
    signIn: '/auth/login',
    error:  '/auth/login',
  },

  session: {
    strategy: 'jwt',
    maxAge:   8 * 60 * 60,
  },
});
