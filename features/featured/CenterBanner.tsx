/**
 * 모든 페이지 위 센터 띠: 이번 주 강아지·고양이 1위(기획서 "1위는 다음 라운드 내내 사이트 곳곳에 걸린다").
 * 게시판·글 상세 맨 위에 둔다. 메인은 센터 화보가 같은 일을 하므로 넣지 않는다.
 * 이름을 누르면 글 상세, 옆 SNS 글자를 누르면 그 아이 SNS 로 간다. 노출·클릭은 place "banner" 로 남긴다.
 * 센터가 아직 없거나 읽지 못하면 띠를 그리지 않는다(페이지는 그대로 뜬다).
 */
import Link from "next/link";
import { BOARD_NAME, SNS_NAME, firstSns, type Board } from "@/shared/lib/format";
import { photoUrl } from "@/shared/lib/supabase/env";
import { Impression } from "@/features/sns/Impression";
import { SnsLink } from "@/features/sns/SnsLink";
import { getFeatured } from "./server";
import s from "./featured.module.css";

export async function CenterBanner({ board }: { board?: Board }) {
  const all = await getFeatured()
    .then((f) => f.center)
    .catch(() => []);
  // 지금 보는 게시판의 센터를 앞에
  const center = board ? [...all].sort((a, b) => Number(b.board === board) - Number(a.board === board)) : all;
  if (!center.length) return null;
  return (
    <Impression className={s.banner} ids={center.filter((c) => firstSns(c)).map((c) => c.entry_id)} place="banner">
      {/* 아래 차트 1위와 헷갈리지 않게: 지난 라운드 1위가 이번 주 센터다 */}
      <small>지난 라운드 1위 · 이번 주 센터</small>
      <ul>
        {center.map((c) => {
          const sns = firstSns(c);
          return (
            <li key={c.entry_id}>
              <Link href={`/${c.board}/${c.entry_id}`}>
                <img src={photoUrl(c.thumb_path) ?? undefined} alt="" loading="lazy" decoding="async" />
                {c.pet_name}
                <span>{BOARD_NAME[c.board]}</span>
              </Link>
              {sns ? (
                <SnsLink className={s.bannerSns} entryId={c.entry_id} sns={sns} place="banner" iconSize="sm">
                  <span className="sr-only">{c.pet_name} </span>
                  {SNS_NAME[sns.kind]}
                  <span aria-hidden="true"> ↗</span>
                </SnsLink>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Impression>
  );
}
