const isDev = process.env.NODE_ENV === "development";
const defaultBasePath = isDev || process.env.VERCEL_ENV === "preview"
  ? ""
  : "/uk/cliff-watch";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH !== undefined
  ? process.env.NEXT_PUBLIC_BASE_PATH
  : defaultBasePath;
const devApiOrigin = process.env.CLIFF_WATCH_DEV_API_ORIGIN
  || process.env.NEXT_PUBLIC_API_ORIGIN
  || "http://127.0.0.1:8000";

const nextConfig = {
  ...(basePath ? { basePath } : {}),
  allowedDevOrigins: ["127.0.0.1"],
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  ...(isDev ? {} : { output: "export" }),
  trailingSlash: true,
  assetPrefix: basePath || undefined,
  ...(isDev
    ? {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: `${devApiOrigin}/api/:path*`,
              basePath: false,
            },
            {
              source: "/api/:path*",
              destination: `${devApiOrigin}/api/:path*`,
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;
