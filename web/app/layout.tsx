import type { Metadata } from "next";
import "./globals.css";
import Footer from '../components/Footer';
import MusicPlayer from '../components/MusicPlayer';
import SupportChat from '../components/SupportChat';
import Sidebar from '../components/Sidebar';
import ActiveMatchBanner from '../components/ActiveMatchBanner';
import BroadcastBanner from '../components/BroadcastBanner';
import NotificationBell from '../components/NotificationBell';
import WelcomeModal from '../components/WelcomeModal';
import LinkAccountBanner from '../components/LinkAccountBanner';
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Exquisite COPS",
  description: "Competitive Matchmaking Platform",
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
      </body>
    </html>
  );
}
