import type { Metadata } from "next";
import { Toaster } from 'react-hot-toast'
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aplikasi Kasir",
  description: "Aplikasi Kasir by NB Projects",
  icons: {
    icon: "/logos/app.png",
    apple: "/logos/app.png",
  },
}
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><Toaster position="top-center" toastOptions={{ style: { fontSize: '14px' } }} />
{children}</body>
    </html>
  );
}
