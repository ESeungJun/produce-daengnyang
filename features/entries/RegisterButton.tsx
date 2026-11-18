"use client";
/**
 * "연습생 등록하기". 회원이면 등록 화면으로, 아니면 로그인 시트(문구: 등록)를 띄운다.
 * 등록 화면(/register)은 #5 에서 만든다. 그전까지 회원에게는 준비 중이라고 알린다(없는 주소로 보내지 않게).
 */
import { useLoginSheet } from "@/features/auth/LoginSheet";
import { usePicks } from "@/features/picks/PicksProvider";
import { useToast } from "@/shared/ui/Toast";

export function RegisterButton({ className, children = "연습생 등록하기" }: { className?: string; children?: React.ReactNode }) {
  const { viewer } = usePicks();
  const openLogin = useLoginSheet();
  const toast = useToast();
  return (
    <button
      type="button"
      className={className}
      onClick={() => (viewer === "member" ? toast("연습생 등록은 곧 열려요. 조금만 기다려 주세요") : openLogin("register"))}
    >
      {children}
    </button>
  );
}
