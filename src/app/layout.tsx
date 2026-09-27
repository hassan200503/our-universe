import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { Nav } from "@/components/nav";
import { MeProvider } from "@/components/me-context";
import { PulseProvider } from "@/components/pulse";
import { getCtx } from "@/lib/context";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["SOFT", "opsz"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Our Universe", template: "%s · Our Universe" },
  description: "Hassan's world, Whitney's world, and the story we're writing together.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0e14" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const ctx = await getCtx();
  const pick = (p: NonNullable<typeof ctx>["me"]) => ({ id: p.id, slug: p.slug, displayName: p.displayName, theme: p.theme, avatarUrl: p.avatarUrl });
  const me = ctx ? pick(ctx.me) : null;
  const members = ctx ? ctx.members.map(pick) : [];
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} ${jetbrains.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <Providers>
          <MeProvider me={me} members={members}>
            {ctx ? (
              <PulseProvider>
                <Nav />
                <main className="flex-1 pb-24 sm:pb-0">{children}</main>
              </PulseProvider>
            ) : (
              <main className="flex-1">{children}</main>
            )}
          </MeProvider>
        </Providers>
      </body>
    </html>
  );
}
