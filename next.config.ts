import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // サムネイルはpublic/images/thumbnails/に保存、Vercel CDNで配信
    // remotePatterns不要（ローカル画像のみ）
    minimumCacheTTL: 2592000, // 30日間キャッシュ
  },
};

export default nextConfig;
