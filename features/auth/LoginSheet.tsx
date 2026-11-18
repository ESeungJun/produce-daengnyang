"use client";
/**
 * 로그인 시트. 두 번째 픽·연습생 등록·댓글을 로그인 전에 누르면 같은 시트가 문구만 바꿔 올라온다(DESIGN_SYSTEM 5절).
 * 어디서나 useLoginSheet()("pick" | "register" | "comment" | "login") 로 연다.
 * "구글로 계속하기"의 실제 연결(익명 계정에 구글 붙이기, 이어서 하던 일 실행)은 #3 에서 붙인다.
 * 그전까지는 준비 중이라고 알리고 닫는다.
 */
import { createContext, useCallback, useContext, useState } from "react";
import { Sheet } from "@/shared/ui/Sheet";
import { useToast } from "@/shared/ui/Toast";

export type LoginReason = "pick" | "register" | "comment" | "login";

const TEXT: Record<LoginReason, [string, string]> = {
  // #3(익명 1픽)을 붙이면 두 번째 픽에서 뜨므로 "픽을 더 하려면 로그인해 주세요 … 방금 한 픽도 그대로 이어져요"로 되돌린다.
  pick: ["로그인하면 픽할 수 있어요", "구글 계정으로 로그인하면 댕댕이·냥이 게시판마다 하루 3픽이에요. 로그인 없이 하는 하루 1픽은 곧 열려요."],
  register: ["연습생 등록은 로그인 후에 할 수 있어요", "구글 계정으로 3초면 끝나요. 등록한 아이가 1위를 하면 알림과 메일로 알려 드려요."],
  login: ["구글 계정으로 로그인해요", "로그인하면 댕댕이·냥이 게시판마다 하루 3픽, 연습생 등록과 응원 댓글을 할 수 있어요."],
  comment: ["댓글은 로그인 후에 남길 수 있어요", "쓰던 댓글은 그대로 남아 있어요. 로그인하면 바로 올라가요. 픽을 안 해도 댓글은 달 수 있어요."],
};

const LoginSheetContext = createContext<(reason: LoginReason) => void>(() => {});

export function LoginSheetProvider({ children }: { children: React.ReactNode }) {
  const [reason, setReason] = useState<LoginReason | null>(null);
  const toast = useToast();
  const close = useCallback(() => setReason(null), []);
  const [title, body] = TEXT[reason ?? "pick"];
  return (
    <LoginSheetContext.Provider value={setReason}>
      {children}
      <Sheet
        open={reason !== null}
        title={title}
        body={body}
        mainLabel="구글로 계속하기"
        subLabel="그냥 구경할게요"
        onMain={() => {
          close();
          toast("구글 로그인은 곧 열려요. 조금만 기다려 주세요");
        }}
        onClose={close}
      />
    </LoginSheetContext.Provider>
  );
}

export function useLoginSheet() {
  return useContext(LoginSheetContext);
}
