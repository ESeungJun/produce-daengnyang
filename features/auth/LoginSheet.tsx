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
import { clearPendingCheer, clearPendingComment, clearPendingPick, hrefWithPendingComment, inAppBrowser, openExternal } from "./handoff";
import { trackAuth } from "./track";

/** submit: 등록 폼을 다 쓰고 "등록하기"를 눌렀을 때. 로그인하고 돌아오면 쓴 내용으로 바로 등록한다(/register?submit=1) */
export type LoginReason = "pick" | "register" | "submit" | "comment" | "report" | "login" | "ip" | "gallery" | "cheer";

const TEXT: Record<LoginReason, [string, string]> = {
  // 로그인 없이 하는 첫 1픽을 쓴 뒤(두 번째 픽)에 뜬다
  pick: ["픽을 더 하려면 로그인해 주세요", "구글 계정으로 로그인하면 댕댕이·냥이 게시판마다 하루 3픽이에요. 방금 한 픽도 그대로 이어져요."],
  // 같은 인터넷 연결(와이파이·통신사)에서 오늘 로그인 전 픽이 너무 많을 때(접속 정보별 하루 한도). 이 사람은 픽을 못 했으니 "이어져요"라고 하지 않는다
  ip: ["이 인터넷에서는 오늘 로그인 전 픽이 마감됐어요", "같은 와이파이·통신사 연결에서 여러 사람이 픽했어요. 구글 계정으로 로그인하면 댕댕이·냥이 게시판마다 하루 3픽이에요."],
  register: ["연습생 등록은 로그인 후에 할 수 있어요", "구글 계정으로 3초면 끝나요. 등록한 아이가 1위를 하면 알림과 메일로 알려 드려요."],
  submit: ["로그인하면 바로 등록돼요", "쓴 내용과 사진은 이 기기에 그대로 있어요. 구글 계정으로 로그인하고 돌아오면 다시 누르지 않아도 등록돼요."],
  login: ["구글 계정으로 로그인해요", "로그인하면 댕댕이·냥이 게시판마다 하루 3픽, 연습생 등록과 응원 댓글을 할 수 있어요."],
  // 응원단(#39): 결선 날 알림을 받으려면 계정이 있어야 한다
  cheer: ["로그인하면 응원단에 들어가요", "데뷔 평가가 열리는 날 이 아이에게 픽하러 오라고 알려 드려요."],
  comment: ["댓글은 로그인 후에 남길 수 있어요", "쓰던 댓글은 그대로 남아 있어요. 로그인하면 바로 올라가요. 픽을 안 해도 댓글은 달 수 있어요."],
  // 데뷔 화보 사진을 저장하려는데 로그인이 풀렸을 때(#17). 보던 화보 사진 올리기 화면으로 돌아온다
  gallery: ["로그인하고 다시 저장해 주세요", "로그인이 풀렸어요. 구글 계정으로 로그인하고 돌아오면 사진을 다시 골라 저장해 주세요."],
  report: ["신고는 로그인 후에 할 수 있어요", "같은 사람이 여러 번 신고하지 못하게 구글 계정으로 받아요. 로그인하고 돌아와 신고를 다시 눌러 주세요."],
};

const LoginSheetContext = createContext<(reason: LoginReason) => void>(() => {});

export function LoginSheetProvider({ children }: { children: React.ReactNode }) {
  const [reason, setReason] = useState<LoginReason | null>(null);
  const toast = useToast();
  // "그냥 구경할게요"로 닫으면 적어 둔 댓글·하려던 픽을 지운다(입력칸 글은 그대로라 다시 남기기를 누르면 된다).
  // 나중에 다른 이유로 로그인했을 때 닫아 버린 댓글·픽이 저절로 올라가지 않게(#9 QA 에서 픽이 저절로 나가는 것을 찾음).
  const close = useCallback(() => {
    clearPendingComment();
    clearPendingPick();
    clearPendingCheer();
    setReason(null);
  }, []);
  // 픽이 아닌 이유로 열면 예전에 적어 둔 "하려던 픽"을, 댓글이 아닌 이유로 열면 "쓰던 댓글"을 지운다(엉뚱한 것이 나중에 나가지 않게)
  const open = useCallback((r: LoginReason) => {
    if (r !== "pick" && r !== "ip") clearPendingPick();
    if (r !== "comment") clearPendingComment();
    if (r !== "cheer") clearPendingCheer();
    trackAuth("sheet", r === "submit" ? "register" : r === "report" || r === "gallery" ? "login" : r); // 신고·화보는 로그인으로 센다. 응원단은 cheer 로 따로(#43)
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
        mainData={{ "data-track": "login_google", "data-track-why": reason ?? "pick" }}
        subLabel="그냥 구경할게요"
        onMain={() => {
          // 등록하려다 연 시트면 로그인 뒤 등록 화면으로(폼을 다 쓰고 눌렀으면 바로 등록), 그 밖에는 보던 곳으로 돌아온다
          const next = reason === "submit" ? "/register?submit=1" : reason === "register" ? "/register" : location.pathname + location.search;
          setReason(null); // 쓰던 댓글은 남긴다(돌아와서 올린다)
          const app = inAppBrowser();
          if (app) trackAuth("google", app === "kakao" ? "inapp_kakao" : "inapp_other");
          if (app) {
            // 카톡·안드로이드는 기본 브라우저를 바로 연다. 아이폰의 다른 앱은 메뉴로 안내한다
            // 쓰던 댓글·들어가려던 응원단은 주소에 붙여 넘긴다(새 브라우저에는 이 탭의 저장 공간이 없다).
            // 아이폰은 사용자가 메뉴로 "Safari로 열기"를 누르므로 지금 주소에도 붙여 둔다.
            const carry = hrefWithPendingComment();
            if (carry !== location.href) history.replaceState(history.state, "", carry);
            if (!openExternal(carry)) toast("앱 안 브라우저에서는 구글 로그인이 막혀요. 오른쪽 위 ··· 메뉴에서 'Safari로 열기'를 눌러 주세요");
            return;
          }
          continueWithGoogle(next).catch(() => {
            trackAuth("google", "open_failed");
            toast("구글 로그인 화면을 열지 못했어요. 잠시 뒤 다시 눌러 주세요");
          });
        }}
        onClose={close}
      />
    </LoginSheetContext.Provider>
  );
}

export function useLoginSheet() {
  return useContext(LoginSheetContext);
}
