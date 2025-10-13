/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules[\\/](?:@mediapipe[\\/])/,
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
};

export default nextConfig;
