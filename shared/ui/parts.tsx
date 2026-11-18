/**
 * 상태가 없는 작은 공통 부품: 섹션 제목, 목차, 맨 아래 제호, 정렬 링크.
 * 화면마다 같은 모양을 쓰게 하려고 모았다(DESIGN_SYSTEM.md 5절).
 */
import Link from "next/link";
import s from "./ui.module.css";

export function SectionHead({ id, title, sub }: { id?: string; title: string; sub?: string }) {
  return (
    <>
      <h2 id={id} className={s.secH}>
        {title}
      </h2>
      {sub ? <p className={s.secP}>{sub}</p> : null}
    </>
  );
}

export type TocItem = { href: string; title: string; note: string };

export function Toc({ heading, items, className }: { heading: string; items: TocItem[]; className?: string }) {
  return (
    <nav className={`${s.toc} ${className ?? ""}`} aria-label={heading}>
      <h2>{heading}</h2>
      <ul>
        {items.map((it) => (
          <li key={it.href}>
            <a href={it.href}>
              <b>{it.title}</b>
              <span>{it.note}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** 맨 아래 제호. 휴대폰은 두 줄, 데스크톱은 한 줄로 크게. */
export function Colophon({ issue }: { issue: string }) {
  return (
    <p className={s.close}>
      프로듀스 <br className={s.mobileBreak} />
      댕냥
      <small>{issue} · 표는 언제나 무료</small>
    </p>
  );
}

export type SortOption = { key: string; label: string; href: string };

/** 정렬 링크(인기순·최신순). 가림 기간에는 인기순 자리에 "섞어 보기"가 온다. */
export function SortLinks({ options, current, note }: { options: SortOption[]; current: string; note?: string }) {
  return (
    <nav className={s.sort} aria-label="정렬">
      {options.map((o) => (
        <Link key={o.key} href={o.href} aria-current={o.key === current ? "true" : undefined} scroll={false} replace>
          {o.label}
        </Link>
      ))}
      {note ? <em>{note}</em> : null}
    </nav>
  );
}

export const ui = s;
