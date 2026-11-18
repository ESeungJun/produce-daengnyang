/** 내 글 고치기(/dog/<글 번호>/edit). 조립은 features/register/EditPage. */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isBoard } from "@/shared/lib/format";
import { EditPage } from "@/features/register/EditPage";

export const metadata: Metadata = { title: "글 고치기", robots: { index: false } };

type Props = { params: Promise<{ board: string; id: string }> };

export default async function Page({ params }: Props) {
  const { board, id } = await params;
  if (!isBoard(board)) notFound();
  return <EditPage board={board} id={id} />;
}
