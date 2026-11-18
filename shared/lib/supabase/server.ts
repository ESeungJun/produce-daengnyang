/**
 * 서버 컴포넌트용 Supabase 클라이언트. 요청 쿠키의 로그인 세션으로 RPC 를 부른다(세션이 없으면 손님 anon).
 * 표는 RLS 로 닫혀 있어 화면 데이터는 board_entries·get_featured 같은 함수로만 받는다(설계서 3-1).
 * 세션 갱신(쿠키 다시 쓰기)은 #3 의 proxy 가 맡는다. 서버 컴포넌트에서는 쿠키를 쓸 수 없어 setAll 실패를 무시한다.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

export async function createClient() {
  const store = await cookies();
  const { url, key } = supabaseEnv();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // 서버 컴포넌트 렌더 중에는 쿠키를 쓸 수 없다. 갱신은 proxy(#3)에서 한다.
        }
      },
    },
  });
}
