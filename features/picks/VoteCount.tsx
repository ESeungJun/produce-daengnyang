"use client";
/**
 * 표 수. 방금 내가 한 픽(+1)을 바로 더해 보여 준다. 가림 기간(null)에는 "??".
 * 서버가 picked_today=true 로 준 줄은 이미 내 픽이 표 수에 들어 있으므로 더하지 않는다(화면을 옮긴 뒤 +1 이 두 번 붙지 않게).
 */
import { count } from "@/shared/lib/format";
import { usePicks } from "./PicksProvider";

export function VoteCount({ entryId, base, pickedToday = false }: { entryId: string; base: number | null; pickedToday?: boolean }) {
  const { bump } = usePicks();
  return <>{base == null ? "??" : count(base + (pickedToday ? 0 : bump(entryId)))}</>;
}
