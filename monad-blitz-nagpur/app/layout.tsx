import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import Navbar from "./components/Navbar";
import { Footer } from "./components/footer";
import "./globals.css";

// Disable static generation for pages that use Clerk
export const dynamic = 'force-dynamic';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CryptoBazaar - Secure P2P Crypto Trading",
  description: "Trade USDT securely with CryptoBazaar's P2P platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Safe fallback for Clerk publishable key during build
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
  
  return (
    <ClerkProvider publishableKey={clerkKey || 'pk_test_placeholder'}>
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}>
          <Navbar />
          {/* Add top padding to main so content starts below navbar (navbar height + margin) */}
          <main className="flex-1 flex flex-col">
            {children}
          </main>
          {/* <Footer /> */}
        </body>
      </html>
    </ClerkProvider>
  );
}
