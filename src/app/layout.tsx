import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aerorides – GPS Tracker",
  description: "GPS-basierter Strecken-Tracker mit Echtzeit-Tachometer",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body style={{ margin: 0, padding: 0, background: "#000", overflow: "hidden" }}>
        {children}
      </body>
    </html>
  );
}
