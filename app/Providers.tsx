"use client";
/** 화면 전체가 같이 쓰는 상태: 토스트 → 로그인 시트 → 오늘 남은 픽(픽이 시트·토스트를 부르므로 이 순서). */
import { LoginSheetProvider } from "@/features/auth/LoginSheet";
import { RegisterSW } from "@/features/pwa/RegisterSW";
import { PicksProvider, type PicksInit } from "@/features/picks/PicksProvider";
import { useEffect } from "react";
import { browserVisitorKey } from "@/shared/lib/visitor";
import { takeFlash } from "@/shared/ui/flash";
import { ToastProvider, useToast } from "@/shared/ui/Toast";

export function Providers({ picks, children }: { picks: PicksInit; children: React.ReactNode }) {
  // 방문자 키 쿠키를 첫 화면에서 만들어 둔다. 다음 요청부터 서버가 가림 기간 섞기 seed 로 읽는다.
  useEffect(() => {
    try {
      browserVisitorKey();
    } catch {
      // 쿠키가 막힌 브라우저면 손님 공통 순서로 본다.
    }
  }, []);
  return (
    <ToastProvider>
      <RegisterSW />
      <FlashToast />
      <LoginSheetProvider>
        {/* 서버가 다른 로그인 상태로 그리면(구글에서 돌아온 새 페이지 등) 남은 픽 상태를 새 값으로 다시 만든다. 손님 첫 픽은 PicksProvider 안에서만 바꾼다 */}
        <PicksProvider key={picks.viewer} init={picks}>
          {children}
        </PicksProvider>
      </LoginSheetProvider>
    </ToastProvider>
  );
}

/** 전 화면이 남긴 한 번짜리 안내(로그아웃·탈퇴)를 띄운다 */
function FlashToast() {
  const toast = useToast();
  useEffect(() => {
    const t = setTimeout(() => {
      const v = takeFlash();
      if (v) toast(v);
    }, 300);
    return () => clearTimeout(t);
  }, [toast]);
  return null;
}
