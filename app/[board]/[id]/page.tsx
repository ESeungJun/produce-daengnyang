/** 글 상세(/dog/<글 번호>). 조립은 features/entries/DetailPage. */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isBoard } from "@/shared/lib/format";
import { DetailPage, getEntry } from "@/features/entries/DetailPage";

type Props = { params: Promise<{ board: string; id: string }>; searchParams: Promise<{ new?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { board, id } = await params;
  if (!isBoard(board)) return {};
  const e = await getEntry(id);
  if (e === "deleted") return { title: "지워진 글이에요" };
  return e ? { title: `${e.pet_name} 픽해 주세요`, description: e.bio ?? undefined } : {};
}

export default async function Page({ params, searchParams }: Props) {
  const [{ board, id }, q] = await Promise.all([params, searchParams]);
  if (!isBoard(board)) notFound();
  // ?new=1: 등록하고 바로 온 길(RegisterForm)
  return <DetailPage board={board} id={id} fresh={q.new === "1"} />;
}
