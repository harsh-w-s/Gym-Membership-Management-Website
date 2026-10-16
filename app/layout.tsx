import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

const GYM_NAME = process.env.GYM_NAME || "My Gym";

export const metadata: Metadata = {
  title: { default: `${GYM_NAME} · Dashboard`, template: `%s · ${GYM_NAME}` },
  robots: { index: false, follow: false }, // private owner tool
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Sidebar gymName={GYM_NAME} />
        <main className="md:pl-60">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-10">{children}</div>
        </main>
      </body>
    </html>
  );
}
