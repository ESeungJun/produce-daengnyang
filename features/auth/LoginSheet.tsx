"use client";
/**
 * 로그인 시트. 두 번째 픽·연습생 등록·댓글을 로그인 전에 누르면 같은 시트가 문구만 바꿔 올라온다(DESIGN_SYSTEM 5절).
 * 어디서나 useLoginSheet()("pick" | "register" | "comment" | "login") 로 연다.
 * "구글로 계속하기": 익명이면 같은 사용자에 구글을 붙이고(오늘 픽이 그대로), 아니면 구글 로그인(features/auth/session.ts).
 * 구글 화면으로 갔다가 지금 보던 주소로 돌아온다.
 * 카카오톡·인스타 같은 앱 안 브라우저는 구글이 로그인을 막으므로, 기본 브라우저로 열도록 안내한다(카톡은 바로 열기).
 */
import { createContext, useCallback, useContext, useState } from "react";
import { Sheet } from "@/shared/ui/Sheet";
import { useToast } from "@/shared/ui/Toast";
import { continueWithGoogle } from "./session";
import { clearPendingPick, inAppBrowser } from "./handoff";

export type LoginReason = "pick" | "register" | "comment" | "login";

const TEXT: Record<LoginReason, [string, string]> = {
  // 로그인 없이 하는 첫 1픽을 쓴 뒤(두 번째 픽)에 뜬다
  pick: ["픽을 더 하려면 로그인해 주세요", "구글 계정으로 로그인하면 댕댕이·냥이 게시판마다 하루 3픽이에요. 방금 한 픽도 그대로 이어져요."],
  register: ["연습생 등록은 로그인 후에 할 수 있어요", "구글 계정으로 3초면 끝나요. 등록한 아이가 1위를 하면 알림과 메일로 알려 드려요."],
  login: ["구글 계정으로 로그인해요", "로그인하면 댕댕이·냥이 게시판마다 하루 3픽, 연습생 등록과 응원 댓글을 할 수 있어요."],
  comment: ["댓글은 로그인 후에 남길 수 있어요", "쓰던 댓글은 그대로 남아 있어요. 로그인하면 바로 올라가요. 픽을 안 해도 댓글은 달 수 있어요."],
};

const LoginSheetContext = createContext<(reason: LoginReason) => void>(() => {});

export function LoginSheetProvider({ children }: { children: React.ReactNode }) {
  const [reason, setReason] = useState<LoginReason | null>(null);
  const toast = useToast();
  const close = useCallback(() => setReason(null), []);
  // 픽이 아닌 이유로 열면 예전에 적어 둔 "하려던 픽"을 지운다(엉뚱한 픽이 나중에 나가지 않게)
  const open = useCallback((r: LoginReason) => {
    if (r !== "pick") clearPendingPick();
    setReason(r);
  }, []);
  const [title, body] = TEXT[reason ?? "pick"];
  return (
    <LoginSheetContext.Provider value={open}>
      {children}
      <Sheet
        open={reason !== null}
        title={title}
        body={body}
        mainLabel="구글로 계속하기"
        subLabel="그냥 구경할게요"
        onMain={() => {
          close();
          const app = inAppBrowser();
          if (app === "kakao") {
            location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(location.href)}`;
            return;
          }
          if (app) {
            toast("앱 안 브라우저에서는 구글 로그인이 막혀요. 오른쪽 위 메뉴에서 '다른 브라우저로 열기'를 눌러 주세요");
            return;
          }
          continueWithGoogle(location.pathname + location.search).catch(() => toast("구글 로그인 화면을 열지 못했어요. 잠시 뒤 다시 눌러 주세요"));
        }}
        onClose={close}
      />
    </LoginSheetContext.Provider>
  );
}

export function useLoginSheet() {
  return useContext(LoginSheetContext);
}
