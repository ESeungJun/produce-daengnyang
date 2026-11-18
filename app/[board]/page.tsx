/** 게시판(/dog, /cat). ?sort=latest 면 최신순, ?q= 는 이름 검색(#5). 조립은 features/entries/BoardPage. */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BOARD_NAME, isBoard } from "@/shared/lib/format";
import { BoardPage } from "@/features/entries/BoardPage";
import { cleanQuery } from "@/features/entries/search";

type Props = { params: Promise<{ board: string }>; searchParams: Promise<{ sort?: string; q?: string | string[] }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { board } = await params;
  if (!isBoard(board)) return {};
  // 검색 결과 주소는 검색 엔진에 올리지 않는다(같은 게시판이 검색어마다 늘어나지 않게)
  const { q } = await searchParams;
  return { title: `${BOARD_NAME[board]} 연습생`, ...(cleanQuery(q) ? { robots: { index: false, follow: true } } : {}) };
}

export default async function Page({ params, searchParams }: Props) {
  const { board } = await params;
  if (!isBoard(board)) notFound();
  const { sort, q } = await searchParams;
  return <BoardPage board={board} sort={sort === "latest" ? "latest" : "popular"} q={cleanQuery(q)} />;
}
