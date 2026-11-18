"use client";
/**
 * 공유 주소(?ref=share)로 들어온 방문을 한 번 남기고, 주소창에서 ref 를 뺀다(#15).
 * 주소를 그대로 두면 그 사람이 다시 공유할 때·새로고침할 때도 공유 방문으로 섞여서 뺀다.
 * 같은 사람·날·글은 DB 가 한 번만 센다. 미리보기를 가져가는 메신저 봇은 스크립트를 돌리지 않아 세지 않는다.
 */
import { useEffect } from "react";
import { trackSns } from "@/features/sns/track";
import { takeShareRef } from "./link";

export function ShareVisit({ entryId }: { entryId: string }) {
  useEffect(() => {
    const { shared, clean } = takeShareRef(location.href);
    if (!shared) return;
    trackSns([entryId], "share_visit", "detail");
    history.replaceState(history.state, "", clean);
  }, [entryId]);
  return null;
}
