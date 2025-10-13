/** @type {import('next').NextConfig} */
const IMG_LY_ASSET_VERSION = process.env.IMG_LY_ASSET_VERSION ?? '1.7.0'

const nextConfig = {
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules[\\/](onnxruntime-web|@imgly[\\/])/,
      type: 'javascript/esm',
    });

    if (!isServer && Array.isArray(config.optimization?.minimizer)) {
      config.optimization.minimizer = config.optimization.minimizer.map(minimizer => {
        if (minimizer?.options) {
          const terserOptions = minimizer.options.terserOptions ?? {};
          if (terserOptions.module !== true) {
            minimizer.options.terserOptions = {
              ...terserOptions,
              module: true,
            };
          }
        }
        return minimizer;
      });
    }

    return config;
  },
  async rewrites() {
    return [
      {
        source: '/imgly-assets/:path*',
        destination: `https://cdn.jsdelivr.net/npm/@imgly/background-removal-data@${IMG_LY_ASSET_VERSION}/dist/:path*`,
      },
    ];
  },
};

export default nextConfig;
