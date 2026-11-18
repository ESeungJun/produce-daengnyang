/**
 * 이번 주 센터 화보(강아지·고양이 3:4 두 장 엇갈림)와 데뷔조 후보 폴라로이드.
 */
import Link from "next/link";
import { BOARD_NAME, SNS_NAME, snsLinks } from "@/shared/lib/format";
import { photoUrl } from "@/shared/lib/supabase/env";
import { Impression } from "@/features/sns/Impression";
import { SnsLink } from "@/features/sns/SnsLink";
import type { FeaturedCard } from "./api";
import s from "./featured.module.css";

/**
 * center: 이번 주 센터(강아지·고양이). past: 이번 달 지난 라운드 센터(데스크톱에서만 2장 더, 휴대폰은 숨김, SNS 칸 없음).
 * 사진을 누르면 글 상세로, 이름 아래 SNS 칸을 누르면 그 아이 SNS 로 간다(클릭·노출을 기록해 이동률을 잰다).
 */
export function CenterSpread({ center, past }: { center: FeaturedCard[]; past: FeaturedCard[] }) {
  const items = [...center.map((c) => ({ c, label: `${BOARD_NAME[c.board]} 센터`, now: true })), ...past.slice(0, 2).map((c) => ({ c, label: `${c.round_seq}라운드 센터`, now: false }))];
  // 이동률 분모: SNS 칸이 실제로 보이는 이번 주 센터만(지난 센터는 칸을 두지 않는다)
  const seen = center.filter((c) => snsLinks(c).length > 0).map((c) => c.entry_id);
  return (
    <Impression className={s.spread} ids={seen} place="center">
      {items.map(({ c, label, now }) => (
        <figure key={c.entry_id}>
          <Link href={`/${c.board}/${c.entry_id}`}>
            <img src={photoUrl(c.path) ?? undefined} alt={`${BOARD_NAME[c.board]} 센터 ${c.pet_name}`} loading="lazy" decoding="async" />
          </Link>
          <figcaption>
            <small>{label}</small>
            <b>{c.pet_name}</b>
            {now && snsLinks(c).length ? (
              <span className={s.sns}>
                {snsLinks(c).map((x) => (
                  <SnsLink key={x.kind} className={s.snsChip} entryId={c.entry_id} sns={x} place="center" iconSize="sm">
                    <span className="sr-only">{c.pet_name} </span>
                    {SNS_NAME[x.kind]}
                  </SnsLink>
                ))}
              </span>
            ) : null}
          </figcaption>
        </figure>
      ))}
    </Impression>
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
