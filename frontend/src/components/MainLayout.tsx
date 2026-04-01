'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import AuthGuard from './auth/AuthGuard';

export default function MainLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isLoginPath = pathname === '/login';

    if (isLoginPath) {
        return <AuthGuard>{children}</AuthGuard>;
    }

    return (
        <AuthGuard>
            <div className="app-container">
                <Sidebar />
                <main className="main-content">
                    <div className="main-content-inner">
                        {children}
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
}
