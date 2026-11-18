/** 게시판(/dog, /cat). ?sort=latest 면 최신순. 조립은 features/entries/BoardPage. */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BOARD_NAME, isBoard } from "@/shared/lib/format";
import { BoardPage } from "@/features/entries/BoardPage";

type Props = { params: Promise<{ board: string }>; searchParams: Promise<{ sort?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { board } = await params;
  return isBoard(board) ? { title: `${BOARD_NAME[board]} 연습생` } : {};
}

export default async function Page({ params, searchParams }: Props) {
  const { board } = await params;
  if (!isBoard(board)) notFound();
  const { sort } = await searchParams;
  return <BoardPage board={board} sort={sort === "latest" ? "latest" : "popular"} />;
}
