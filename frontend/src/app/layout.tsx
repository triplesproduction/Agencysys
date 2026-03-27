import './globals.css';
import './layout.css';
import type { Metadata } from 'next';
import { Providers } from './providers';
import MainLayout from '@/components/MainLayout';

export const metadata: Metadata = {
    title: 'TripleS OS Phase 1',
    description: 'Internal Agency Operating System',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>
                <Providers>
                    <MainLayout>{children}</MainLayout>
                </Providers>
            </body>
        </html>
    );
}
