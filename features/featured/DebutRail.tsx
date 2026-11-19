/**
 * 메인 양옆 세로 배너(#16): 왼쪽 데뷔 댕댕이, 오른쪽 데뷔 냥이. 화면 폭 1280px 이상에서만 보이고 스크롤해도 따라온다.
 * 사진(여러 장이면 자동으로 넘김)·이름·표 수 어디를 눌러도 글 상세로 간다. SNS 는 아래 앱 아이콘 버튼.
 * 그 게시판에 데뷔가 없으면(숨김 등) 게시판으로 가는 빈 배너.
 * #26 한쪽 보기(댕댕이·냥이만)에서는 양옆 둘 다 그 게시판 데뷔 아이다. 오른쪽은 variant="gallery": 화보 사진(gallery)을 넘기고,
 * 화보 사진이 없으면 원래 사진을 얼굴 쪽으로 당겨 다른 구도로 보여 준다. 같은 아이 SNS 가 두 번 나오지 않게 아래는 "화보 보러 가기".
 * 노출 기록은 표지와 같은 자리(cover)로 센다. 휴대폰 표지와 동시에 보이는 일은 없다(화면 폭으로 나뉨). 배너만 따로 보려면
 * record_sns 의 자리 허용값에 rail 을 더해야 해서 #16 에서는 합쳐 센다(설계서 4-8).
 */
import Link from "next/link";
import { BOARD_NAME, SNS_NAME, count, snsLinks, type Board } from "@/shared/lib/format";
import { Impression } from "@/features/sns/Impression";
import { SnsLink } from "@/features/sns/SnsLink";
import { debutPhotos, railShot, type FeaturedCard } from "./api";
import { PhotoFade } from "./PhotoFade";
import s from "./featured.module.css";

/** 가운데 표지와 같은 사진이 나란히 보이지 않게, 사진이 여러 장이면 두 번째 장부터 돌린다 */
export function railPhotos(paths: string[]): string[] {
  return paths.length > 1 ? [...paths.slice(1), paths[0]] : paths;
}

type Props = { board: Board; card?: FeaturedCard; debutMonth: string; variant?: "photos" | "gallery" };

export function DebutRail({ board, card, debutMonth, variant = "photos" }: Props) {
  const title = `${debutMonth}월 데뷔 · ${BOARD_NAME[board]}`;
  if (!card) {
    return (
      <aside className={s.rail} aria-label={title}>
        <Link className={`${s.railCard} ${s.railBlank}`} href={`/${board}`}>
          <span className={s.kick}>{title}</span>
          <b>이번 달 {BOARD_NAME[board]} 데뷔는 쉬어요</b>
          <span>{BOARD_NAME[board]} 게시판 보기 →</span>
        </Link>
      </aside>
    );
  }
  const sns = snsLinks(card);
  const gallery = variant === "gallery";
  const shots = (card.gallery ?? []).map(railShot).filter(Boolean) as string[];
  const href = `/${card.board}/${card.entry_id}`;
  return (
    <aside className={s.rail} aria-label={gallery ? `${title} 화보` : title}>
      <Link className={s.railCard} href={href} data-zoom={gallery && !shots.length ? "true" : undefined}>
        <PhotoFade paths={gallery && shots.length ? shots : railPhotos(debutPhotos(card))} alt={`${title} ${card.pet_name}${gallery ? " 화보" : ""}`} eager />
        <span className={s.scrim} />
        <span className={s.railLines}>
          <span className={s.kick}>{title}</span>
          <span className={s.railName}>{card.pet_name}</span>
          <span className={s.cap}>{gallery ? "데뷔 화보" : `${count(card.votes)}표로 데뷔`}</span>
        </span>
      </Link>
      {gallery ? (
        <p className={s.railSns}>
          <Link className={s.railMore} href={href}>
            {card.pet_name} 화보 보러 가기 →
          </Link>
        </p>
      ) : sns.length ? (
        <Impression className={s.railSns} ids={[card.entry_id]} place="cover">
          <span className={s.railSnsCap}>{card.pet_name} SNS 구경 가기</span>
          {sns.map((x) => (
            <SnsLink
              key={x.kind}
              className={s.railSnsBtn}
              entryId={card.entry_id}
              sns={x}
              place="cover"
              iconOnly
              iconSize="lg"
              label={`${card.pet_name} ${SNS_NAME[x.kind]} ${x.handle}, 새 창`}
            />
          ))}
        </Impression>
      ) : null}
    </aside>
  );
}
