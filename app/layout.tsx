import "./globals.css";
import { SessionProvider } from "./providers";
import { VisitTracker } from "@/components/VisitTracker";

export const metadata = {
  title: "Afrotech.ai - Where rhythm meets code",
  description:
    "An immersive digital experience combining Afrobeats, tech, and community",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">
        <SessionProvider>{children}</SessionProvider>
        <VisitTracker />
      </body>
    </html>
  );
}
