/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: '/ai/policy-harmonization', destination: '/alignment', permanent: true },
    ];
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ensure pdfkit font files are accessible
      config.resolve.alias = {
        ...config.resolve.alias,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
