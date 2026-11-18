/**
 * 로그인 세션 갱신(#3). 접속 토큰이 만료되면 refresh 토큰으로 새로 받아 쿠키에 다시 쓴다.
 * 서버 컴포넌트는 쿠키를 쓸 수 없어서(server.ts) 갱신은 여기서만 한다.
 * - Next 16 의 이름은 proxy.ts 지만 그건 Node 런타임 전용이고, OpenNext Cloudflare 는 Node 미들웨어를 "실험"으로만 지원한다.
 *   그래서 Edge 런타임으로 도는 middleware.ts 를 쓴다(Next 가 이름이 바뀌었다고 경고만 한다). 결정기록 참고.
 * - 로그인 쿠키(sb-…-auth-token)가 없는 손님은 아무것도 하지 않는다(Auth 서버를 부르지 않는다).
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const hasSession = req.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
  if (!hasSession) return NextResponse.next();

  let res = NextResponse.next({ request: req });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list, headers) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
        // 새 쿠키가 실린 응답이 공유 캐시에 남지 않게(@supabase/ssr 이 Cache-Control 등을 넘겨준다)
        for (const [k, v] of Object.entries(headers ?? {})) res.headers.set(k, v);
      },
    },
  });
  // getClaims 가 만료를 보고 필요하면 갱신한다(갱신된 쿠키는 위 setAll 로 응답에 실린다)
  await supabase.auth.getClaims().catch(() => null);
  return res;
}

export const config = {
  // 화면 주소만. 정적 파일·이미지·콜백(콜백은 스스로 세션을 만든다)은 건너뛴다.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:png|jpg|jpeg|webp|svg|ico|txt|xml)$).*)"],
};
