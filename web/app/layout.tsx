import type { Metadata, Viewport } from "next";
import "./globals.css";
import Footer from '../components/Footer';
import MusicPlayer from '../components/MusicPlayer';
import SupportChat from '../components/SupportChat';
import Sidebar from '../components/Sidebar';
import ActiveMatchBanner from '../components/ActiveMatchBanner';
import BroadcastBanner from '../components/BroadcastBanner';
import NotificationBell from '../components/NotificationBell';
import UpdatesBell from '../components/UpdatesBell';
import WelcomeModal from '../components/WelcomeModal';
import UpdatePopup from '../components/UpdatePopup';
import LinkAccountBanner from '../components/LinkAccountBanner';
import { Providers } from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL("https://exquisitecops.netlify.app"),
  title: {
    default: "Exquisite COPS",
    template: "%s · Exquisite COPS",
  },
  description:
    "Competitive Critical Ops matchmaking — ranked matches, an ELO ladder, clubs, tournaments and more. Queue up, climb the ranks, and prove you're the best.",
  keywords: ["Critical Ops", "matchmaking", "competitive", "ranked", "ELO", "tournaments", "clubs", "esports", "Exquisite COPS"],
  applicationName: "Exquisite COPS",
  openGraph: {
    type: "website",
    siteName: "Exquisite COPS",
    title: "Exquisite COPS",
    description: "Competitive Critical Ops matchmaking — ranked matches, an ELO ladder, clubs and tournaments. Queue up and climb the ranks.",
    url: "https://exquisitecops.netlify.app",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Exquisite COPS",
    description: "Competitive Critical Ops matchmaking — ranked matches, an ELO ladder, clubs and tournaments.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0e",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>
          <Sidebar />
          <ActiveMatchBanner />
          <NotificationBell />
          <UpdatesBell />
          <div className="app-content pt-14 md:pt-0">
            <BroadcastBanner />
            <LinkAccountBanner />
            {children}
            <Footer />
          </div>
        </Providers>
        <MusicPlayer />
        <SupportChat />
        <WelcomeModal />
        <UpdatePopup />
      </body>
    </html>
  );
}
