/**
 * 이번 주 센터 화보(강아지·고양이 3:4 두 장 엇갈림)와 데뷔조 후보 폴라로이드.
 */
import Link from "next/link";
import { BOARD_NAME } from "@/shared/lib/format";
import { photoUrl } from "@/shared/lib/supabase/env";
import type { FeaturedCard } from "./api";
import s from "./featured.module.css";

/**
 * center: 이번 주 센터(강아지·고양이). past: 이번 달 지난 라운드 센터(데스크톱에서만 2장 더, 휴대폰은 숨김).
 */
export function CenterSpread({ center, past }: { center: FeaturedCard[]; past: FeaturedCard[] }) {
  const items = [...center.map((c) => ({ c, label: `${BOARD_NAME[c.board]} 센터` })), ...past.slice(0, 2).map((c) => ({ c, label: `${c.round_seq}라운드 센터` }))];
  return (
    <div className={s.spread}>
      {items.map(({ c, label }) => (
        <figure key={c.entry_id}>
          <Link href={`/${c.board}/${c.entry_id}`}>
            <img src={photoUrl(c.path) ?? undefined} alt={`${BOARD_NAME[c.board]} 센터 ${c.pet_name}`} loading="lazy" decoding="async" />
          </Link>
          <figcaption>
            <small>{label}</small>
            <b>{c.pet_name}</b>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function Polaroids({ items }: { items: FeaturedCard[] }) {
  return (
    <ul className={s.polas}>
      {items.map((c) => (
        <li key={`${c.entry_id}`} className={s.pola}>
          <Link href={`/${c.board}/${c.entry_id}`}>
            <img src={photoUrl(c.thumb_path) ?? undefined} alt="" loading="lazy" decoding="async" />
            <span>
              <b>{c.pet_name}</b>
              {c.round_seq}R {c.rank}위 · {BOARD_NAME[c.board]}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
