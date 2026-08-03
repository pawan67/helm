import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'HELM Docs',
    template: '%s · HELM Docs',
  },
  description:
    'Build and setup guide for HELM — a self-hosted ESP32 bar node (pull-up + climate tracker with IR control) and its Next.js console.',
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
