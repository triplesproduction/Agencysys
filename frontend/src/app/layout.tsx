import './globals.css';
import './layout.css';
import type { Metadata } from 'next';
import Sidebar from '@/components/Sidebar';
import { Providers } from './providers';

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
                <div className="app-container">
                    <Providers>
                        <Sidebar />
                        <main className="main-content">
                            <div className="main-content-inner">
                                {children}
                            </div>
                        </main>
                    </Providers>
                </div>
            </body>
        </html>
    );
}
