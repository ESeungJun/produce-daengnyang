import type { NextConfig } from "next";

// create-next-app 16.4 기본값인 cacheComponents·partialPrefetching 은 끈다.
// Cloudflare Workers(OpenNext 1.20)에서 켜 두면 Next 가 "Workers 의 setTimeout 구현에서는
// Cache Components 동작을 보장할 수 없다"고 경고하고, 요청이 멈춰 500 이 난다(2026-11-18 #1 확인).
// 화면 데이터는 서버 컴포넌트에서 Supabase 를 바로 읽고, 캐시는 설계서 6절대로 둔다.

const dev = process.env.NODE_ENV !== "production";
// 사진(Storage)·RPC·로그인이 오가는 Supabase 주소. 빌드할 때 값이 들어간다(.env.local / Cloudflare 빌드 변수).
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWs = supabase.replace(/^http/, "ws");

/**
 * 보안 헤더(#11). XSS 가 나도 다른 곳으로 데이터를 보내거나 남의 스크립트를 불러오지 못하게 출처를 좁힌다.
 * - script 'unsafe-inline': Next 가 페이지마다 넣는 인라인 스크립트 때문. nonce 방식은 모든 페이지를 동적으로 그려야 해서 지금은 쓰지 않는다.
 * - 'unsafe-eval' 은 개발 서버(빠른 새로 고침)에서만.
 * - #3 에서 Turnstile 을 붙이면 script-src·frame-src 에 https://challenges.cloudflare.com 을 더한다.
 * - #3 구글 로그인은 브라우저 signInWithOAuth(주소 이동)로 한다. 폼 제출 뒤 리다이렉트로 하면 form-action 'self' 에 막힌다.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase}`,
  "font-src 'self'",
  `connect-src 'self' ${supabase} ${supabaseWs}`,
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // http 로컬 Supabase 로 운영 미리보기(npm run preview)를 할 때는 올려 쓰면 사진·RPC 가 깨지므로 https 일 때만
  ...(!dev && supabase.startsWith("https:") ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(dev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
