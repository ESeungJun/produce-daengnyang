import type { NextConfig } from "next";

// create-next-app 16.4 기본값인 cacheComponents·partialPrefetching 은 끈다.
// Cloudflare Workers(OpenNext 1.20)에서 켜 두면 Next 가 "Workers 의 setTimeout 구현에서는
// Cache Components 동작을 보장할 수 없다"고 경고하고, 요청이 멈춰 500 이 난다(2026-11-18 #1 확인).
// 화면 데이터는 서버 컴포넌트에서 Supabase 를 바로 읽고, 캐시는 설계서 6절대로 둔다.
const nextConfig: NextConfig = {};

export default nextConfig;
