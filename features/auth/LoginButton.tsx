"use client";
/** 데스크톱 윗줄 "구글로 로그인". 로그인 전·익명일 때만 보인다. */
import { usePicks } from "@/features/picks/PicksProvider";
import ui from "@/shared/ui/ui.module.css";
import { useLoginSheet } from "./LoginSheet";

export function LoginButton() {
  const { viewer } = usePicks();
  const openLogin = useLoginSheet();
  if (viewer === "member") return null;
  return (
    <button type="button" className={ui.pill} onClick={() => openLogin("login")}>
      구글로 로그인
    </button>
  );
}
