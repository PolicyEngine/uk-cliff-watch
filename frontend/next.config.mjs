const isDev = process.env.NODE_ENV === "development";
// Production and preview both serve under the /uk/uk-cliff-watch basePath so
// the app is embeddable at policyengine.org/uk/uk-cliff-watch (its app-zone
// rewrite) and preview deployments exercise the same routing as production.
// Only local `next dev` serves at root, where the /api proxy rewrite is used.
const defaultBasePath = isDev ? "" : "/uk/uk-cliff-watch";

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
