import { describe, expect, it } from "vitest";
import { DEBUT_SPOTS, debutMail } from "./debutMail";

const ID = "1045dc9e-d98f-4534-8e75-06b7cc2f13d9";
const SITE = "https://example.workers.dev";

describe("debutMail (#27 데뷔 확정 메일)", () => {
  it("제목에 이름과 화보 사진 부탁, 본문에 올리기 링크·가이드 그림·자리 다섯 곳", () => {
    const m = debutMail("debut", { entry_id: ID, pet_name: "보리", board: "dog" }, SITE)!;
    expect(m.subject).toBe("‘보리’ 데뷔 확정! 화보 사진을 올려 주세요");
    expect(m.html).toContain(`href="${SITE}/dog/${ID}/gallery"`);
    expect(m.html).toContain(`src="${SITE}/mail/debut-guide.jpg"`);
    for (const s of DEBUT_SPOTS) expect(m.html).toContain(s.where);
    expect(m.html).toContain("사진 고르는 요령");
    expect(m.text).toContain(`${SITE}/dog/${ID}/gallery`);
  });
  it("이름은 HTML 로 바꿔 넣는다", () => {
    const m = debutMail("debut", { entry_id: ID, pet_name: '<b>"냥"</b>', board: "cat" }, SITE)!;
    expect(m.html).not.toContain("<b>\"냥\"</b>");
    expect(m.html).toContain("&lt;b&gt;&quot;냥&quot;&lt;/b&gt;");
  });
  it("debut 가 아니면 null(센터·후보는 기존 본문)", () => {
    expect(debutMail("center", { entry_id: ID, pet_name: "보리", board: "dog" }, SITE)).toBeNull();
    expect(debutMail("finalist", { entry_id: ID, pet_name: "보리", board: "dog" }, SITE)).toBeNull();
  });
  it("글 정보가 모자라거나 이상하면 null", () => {
    expect(debutMail("debut", { pet_name: "보리", board: "dog" }, SITE)).toBeNull();
    expect(debutMail("debut", { entry_id: ID, board: "bird" }, SITE)).toBeNull();
    expect(debutMail("debut", { entry_id: "../x", board: "dog" }, SITE)).toBeNull();
    expect(debutMail("debut", null, SITE)).toBeNull();
  });
});
