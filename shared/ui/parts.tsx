/**
 * 상태가 없는 작은 공통 부품: 섹션 제목, 바로가기(목차), 정렬 링크.
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

/** 바로가기 묶음. lead 를 주면 제목 아래 한두 줄 소개(메인: 이 사이트가 무엇인지, #16). label 은 읽기 도구용 이름 */
export function Toc({ heading, lead, label, items, className, children }: { heading: string; lead?: string; label?: string; items: TocItem[]; className?: string; children?: React.ReactNode }) {
  return (
    <div className={`${s.toc} ${className ?? ""}`}>
      <h2>{heading}</h2>
      {lead ? <p className={s.tocLead}>{lead}</p> : null}
      {children}
      {/* 랜드마크는 바로가기 목록만(일정 글이 메뉴와 섞여 읽히지 않게, #20) */}
      <nav aria-label={label ?? heading}>
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
    </div>
  );
}

/** 맨 아래 제호. 휴대폰은 두 줄, 데스크톱은 한 줄로 크게. */
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
