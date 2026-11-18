"use client";
/** 내 정보 화면의 손님 안내 버튼: 로그인 시트를 띄운다. */
import ui from "@/shared/ui/ui.module.css";
import { useLoginSheet } from "@/features/auth/LoginSheet";

export function SignInPrompt() {
  const openLogin = useLoginSheet();
  return (
    <button type="button" className={ui.pill} onClick={() => openLogin("login")}>
      구글로 로그인
    </button>
  );
}
