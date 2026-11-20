"use client";
/**
 * 브라우저용 Supabase 클라이언트(픽 보내기, 게시판 이어 불러오기). 한 탭에 하나만 만든다.
 * supabase-js 는 무거워서(첫 화면 JS 의 큰 몫) 처음 누를 때 불러온다. 첫 화면에는 실리지 않는다.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

let client: Promise<SupabaseClient<Database>> | null = null;

export function browserClient(): Promise<SupabaseClient<Database>> {
  if (!client) {
    client = import("@supabase/ssr").then(({ createBrowserClient }) => {
      const { url, key } = supabaseEnv();
      return createBrowserClient<Database>(url, key);
    });
    // 불러오기에 실패하면(네트워크) 다음 누름에서 다시 시도한다.
    client.catch(() => {
      client = null;
    });
  }
  return client;
}
