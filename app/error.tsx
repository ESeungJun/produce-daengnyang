"use client";
/** 화면을 그리다 실패했을 때(DB 연결 등). 다시 시도 버튼은 같은 화면을 다시 불러온다. 오류 내용은 보여 주지 않는다. */
import { Notice } from "@/shared/ui/Notice";
import ui from "@/shared/ui/ui.module.css";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Notice
      title="잠깐 문제가 생겼어요"
      body="화면을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요."
      action={
        <button type="button" className={ui.ghost} onClick={reset}>
          다시 시도
        </button>
      }
    />
  );
}
