/** 데뷔 화보 사진 올리기(/dog/<글 번호>/gallery, #17). 조립은 features/debut/GalleryPage. */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isBoard } from "@/shared/lib/format";
import { GalleryPage } from "@/features/debut/GalleryPage";

export const metadata: Metadata = { title: "화보 사진 올리기", robots: { index: false } };

type Props = { params: Promise<{ board: string; id: string }> };

export default async function Page({ params }: Props) {
  const { board, id } = await params;
  if (!isBoard(board)) notFound();
  return <GalleryPage board={board} id={id} />;
}
