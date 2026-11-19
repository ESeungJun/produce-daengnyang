/**
 * E2E 시작 전 한 번(#9): 로컬 Supabase 주소·키를 읽어 시험에 넘기고, 같은 날 여러 번 돌려도 익명 픽 접속 한도에 걸리지 않게 비운다.
 * 로컬 주소(127.0.0.1·localhost)가 아니면 멈춘다(운영 DB 를 건드리지 않게).
 */
import { localEnv, sql } from "./support";

export default async function globalSetup() {
  const env = localEnv();
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(env.API_URL)) throw new Error(`로컬 Supabase 가 아니에요: ${env.API_URL}`);
  sql("delete from public.anon_ip_daily");
}
