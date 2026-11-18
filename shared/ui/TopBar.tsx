/**
 * 화면 맨 위 줄. 왼쪽은 로고(메인·게시판) 또는 뒤로 가기(글 상세), 오른쪽은 오늘 남은 픽(right)과 로그인·내 정보(login).
 * 남은 픽은 게시판·글 상세에서만 넣는다(#20). 나머지 화면은 login 만 오른쪽에 있다. 내용은 화면이 slot 으로 넣는다(기능 폴더를 모르게).
 */
import Link from "next/link";
import s from "./page.module.css";

type Props = { back?: { href: string; label: string }; nav?: React.ReactNode; right?: React.ReactNode; login?: React.ReactNode };

export function TopBar({ back, nav, right, login }: Props) {
  return (
    <header className={s.bar}>
      {back ? (
        <Link className={s.back} href={back.href}>
          ← {back.label}
        </Link>
      ) : (
        <Link className={s.logo} href="/">
          프로듀스 <em>댕냥</em>
        </Link>
      )}
      {nav ? (
        <nav className={s.nav} aria-label="주요 메뉴">
          {nav}
        </nav>
      ) : null}
      <div className={`${s.right} ${right ? "" : s.solo}`}>
        {right}
        {login ? <span className={s.login}>{login}</span> : null}
      </div>
    </header>
  );
}

export const page = s;
