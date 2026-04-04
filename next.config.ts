import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    minimumCacheTTL: 2592000, // 30日間キャッシュ
    remotePatterns: [
      {
        // 管理画面アップロード画像（Supabase Storage）
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    // 自動パイプライン画像（/images/thumbnails/xxx.jpg）は
    // public/配下のローカル画像のためremotePatterns不要
  },
};

export default nextConfig;
