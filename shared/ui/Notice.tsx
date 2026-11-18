/** 빈 화면 안내(없는 주소·오류). 큰 제목 + 한 줄 + 메인으로 가는 알약 버튼. */
import Link from "next/link";
import ui from "./ui.module.css";
import s from "./page.module.css";

export function Notice({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <main className={`${s.page} ${s.notice}`}>
      <Link className={s.logo} href="/">
        프로듀스 <em>댕냥</em>
      </Link>
      <h1>{title}</h1>
      <p>{body}</p>
      <div className={s.noticeAct}>
        {action}
        <Link className={ui.pill} href="/">
          메인으로
        </Link>
      </div>
    </main>
  );
}
