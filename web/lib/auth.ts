import type { NextAuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID as string,
      clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    // On sign-in, Discord's account.providerAccountId IS the permanent Discord user ID (snowflake).
    async jwt({ token, account }) {
      if (account?.providerAccountId) {
        (token as any).discordId = account.providerAccountId;
      }
      return token;
    },
    // Expose it so the whole app can read session.user.discordId.
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).discordId = (token as any).discordId;
      }
      return session;
    },
  },
};
