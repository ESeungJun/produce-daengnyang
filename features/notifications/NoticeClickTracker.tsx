"use client";
/** 푸시·메일 링크로 들어온 첫 화면에서 알림 클릭을 한 번 센다(#43, click.ts). Providers 에 한 번 둔다 */
import { useEffect } from "react";
import { readNoticeSource, trackNotice } from "./click";

export function NoticeClickTracker() {
  useEffect(() => {
    const src = readNoticeSource(location.href);
    if (!src) return;
    trackNotice(src.kind, src.via);
    history.replaceState(history.state, "", src.clean);
  }, []);
  return null;
}
