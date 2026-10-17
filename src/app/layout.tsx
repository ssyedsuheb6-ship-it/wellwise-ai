import type { Metadata } from "next";
import { Analytics } from '@vercel/analytics/next';
import "./globals.css";
export const metadata: Metadata = { title: "WELLWISE AI | Product guidance, made clearer", description: "A product-guidance companion built around clear, source-verified information." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}<Analytics /></body></html>; }
