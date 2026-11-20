/** 글 상세(/dog/<글 번호>). 조립은 features/entries/DetailPage. */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BOARD_NAME, isBoard } from "@/shared/lib/format";
import { SHARE_OG } from "@/features/share/meta";
import { DetailPage, getEntry } from "@/features/entries/DetailPage";

type Props = { params: Promise<{ board: string; id: string }>; searchParams: Promise<{ new?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { board, id } = await params;
  if (!isBoard(board)) return {};
  const e = await getEntry(id);
  if (e === "deleted") return { title: "지워진 글이에요" };
  if (!e) return {};
  // 공유 미리보기(#8): 제목·설명은 카톡·인스타 카드에 그대로 찍힌다. 그림은 같은 폴더 opengraph-image.tsx
  // 데뷔 화보(#17)는 픽 버튼이 없으니 축하 문구로 바꾼다
  const title = e.debut && !e.hidden ? `${e.pet_name} 데뷔 화보` : `${e.pet_name} 픽해 주세요`;
  const description = e.debut && !e.hidden
    ? `${BOARD_NAME[e.board]} 연습생 ${e.pet_name}이 데뷔했어요. 화보를 구경하고 응원 댓글을 남겨 주세요.`
    : e.bio || `${BOARD_NAME[e.board]} 연습생 ${e.pet_name}에게 오늘의 픽을 주세요. 매주 센터, 월말 데뷔.`;
  return { title, description, openGraph: { ...SHARE_OG, title, description, url: `/${board}/${id}` } };
}

export default async function Page({ params, searchParams }: Props) {
  const [{ board, id }, q] = await Promise.all([params, searchParams]);
  if (!isBoard(board)) notFound();
  // ?new=1: 등록하고 바로 온 길(RegisterForm)
  return <DetailPage board={board} id={id} fresh={q.new === "1"} />;
}
