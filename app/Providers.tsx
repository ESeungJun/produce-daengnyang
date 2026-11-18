"use client";
/** 화면 전체가 같이 쓰는 상태: 토스트 → 로그인 시트 → 오늘 남은 픽(픽이 시트·토스트를 부르므로 이 순서). */
import { LoginSheetProvider } from "@/features/auth/LoginSheet";
import { PicksProvider, type PicksInit } from "@/features/picks/PicksProvider";
import { ToastProvider } from "@/shared/ui/Toast";

export function Providers({ picks, children }: { picks: PicksInit; children: React.ReactNode }) {
  return (
    <ToastProvider>
      <LoginSheetProvider>
        {/* 로그인 상태가 바뀌면(#3 의 router.refresh) 남은 픽 상태를 새 값으로 다시 만든다 */}
        <PicksProvider key={picks.viewer} init={picks}>
          {children}
        </PicksProvider>
      </LoginSheetProvider>
    </ToastProvider>
  );
}
