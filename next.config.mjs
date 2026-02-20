/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "pdf-parse",
      "@xenova/transformers",
      "onnxruntime-node",
    ],
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
