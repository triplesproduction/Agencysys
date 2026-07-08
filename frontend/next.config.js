/** @type {import('next').NextConfig} */

// Extract exact URL to support both local (http) and remote (https) Supabase instances
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://*.supabase.co';
const supabaseWsUrl = supabaseUrl.replace(/^http/i, 'ws');

const securityHeaders = [
    // ── Strict Transport Security ──────────────────────────────────────────────
    // Enforces HTTPS for 2 years; includes subdomains.
    {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
    },
    // ── Clickjacking Protection ───────────────────────────────────────────────
    {
        key: 'X-Frame-Options',
        value: 'DENY',
    },
    // ── MIME Sniffing Protection ──────────────────────────────────────────────
    {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
    },
    // ── Referrer Policy ───────────────────────────────────────────────────────
    {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
    },
    // ── Permissions Policy ────────────────────────────────────────────────────
    // Disable APIs not used by this application.
    {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    },
    // ── Content Security Policy ───────────────────────────────────────────────
    // Carefully tuned for:
    //   - Next.js (dynamic scripts + inline styles from CSS-in-JS)
    //   - Supabase REST API and Realtime WebSocket
    //   - Google Fonts
    //   - blob: URLs for file/image previews
    //   - data: URIs for inline images
    {
        key: 'Content-Security-Policy',
        value: [
            "default-src 'self'",
            // Scripts: self + unsafe-inline + unsafe-eval + blob
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
            // Styles: self + inline (required by Next.js CSS modules, TipTap, tldraw) + CDNs
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
            // Fonts: self + Google + CDNs
            "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net https://cdn.tldraw.com data:",
            // Images: self, blob (previews), data (base64), Supabase storage signed URLs + CDNs
            `img-src 'self' blob: data: ${supabaseUrl} https://lh3.googleusercontent.com https://cdn.jsdelivr.net https://cdn.tldraw.com`,
            // XHR/Fetch: self + Supabase REST + WebSocket + Next.js HMR + CDNs
            `connect-src 'self' ${supabaseUrl} ${supabaseWsUrl} https://cdn.jsdelivr.net https://cdn.tldraw.com`,
            // Frames: deny all (no iframes needed)
            "frame-src 'none'",
            // Objects: deny (no plugins)
            "object-src 'none'",
            // Base URI: restrict to self
            "base-uri 'self'",
            // Form action: restrict to self
            "form-action 'self'",
            // Workers: self + blob (tldraw uses blob workers)
            "worker-src 'self' blob:",
            // Media: self + blob
            "media-src 'self' blob:",
        ].join('; '),
    },
];

const nextConfig = {
    async headers() {
        return [
            {
                // Apply security headers to all routes
                source: '/(.*)',
                headers: securityHeaders,
            },
        ];
    },
};

export default nextConfig;
