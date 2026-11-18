import { describe, expect, it } from "vitest";
import { groupByMonth, type HallCard } from "./api";

const card = (o: Partial<HallCard>): HallCard => ({
  role: "center", board: "dog", round_kind: "weekly", round_seq: 1, round_month: "2026-11-01", ends_at: "2026-11-08T15:00:00Z",
  hidden: false, entry_id: "e", pet_name: "보리", path: null, thumb_path: null, votes: 1, ...o,
});

describe("groupByMonth", () => {
  it("달마다 묶고 최근 달부터, 데뷔와 센터를 나눈다", () => {
    const g = groupByMonth([
      card({ round_month: "2026-10-01", role: "debut", round_kind: "final", round_seq: 0, pet_name: "데뷔" }),
      card({ round_month: "2026-11-01", round_seq: 2, pet_name: "이번달2" }),
      card({ round_month: "2026-10-01", round_seq: 3, pet_name: "지난달3" }),
      card({ round_month: "2026-11-01", round_seq: 1, pet_name: "이번달1" }),
    ]);
    expect(g.map((m) => m.month)).toEqual(["2026-11-01", "2026-10-01"]);
    expect(g[0].center.map((c) => c.pet_name)).toEqual(["이번달2", "이번달1"]);
    expect(g[1].debut.map((c) => c.pet_name)).toEqual(["데뷔"]);
    expect(g[1].center.map((c) => c.pet_name)).toEqual(["지난달3"]);
  });

  it("비어 있으면 빈 배열", () => {
    expect(groupByMonth([])).toEqual([]);
  });
});
