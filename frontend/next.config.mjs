/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3001/api/v1';
        return [
            {
                source: '/api/v1/:path*',
                destination: `${backendUrl}/:path*`,
            },
        ];
    },
};

export default nextConfig;
