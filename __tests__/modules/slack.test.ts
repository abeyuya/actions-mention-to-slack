import {
  buildSlackErrorMessage,
  buildSlackPostMessage,
  buildSlackReviewSubmittedMessage,
} from "../../src/modules/slack.js";

type SectionBlock = {
  type: "section";
  text: { type: "mrkdwn"; text: string };
};

const sectionTexts = (blocks: unknown[]): string[] =>
  blocks
    .filter(
      (b): b is SectionBlock =>
        typeof b === "object" &&
        b !== null &&
        (b as { type?: string }).type === "section",
    )
    .map((b) => b.text.text);

describe("modules/slack", () => {
  describe("buildSlackPostMessage", () => {
    it("should put only the headline in text and split header/body into blocks", () => {
      const result = buildSlackPostMessage(
        ["slackUser1"],
        "title",
        "link",
        "message",
        "sender_github_username",
      );

      const expectedHeadline =
        "<@slackUser1> has been mentioned at <link|title> by sender_github_username";
      expect(result.text).toEqual(expectedHeadline);
      const texts = sectionTexts(result.blocks);
      expect(texts[0]).toEqual(expectedHeadline);
      expect(texts[1]).toEqual("message");
      expect(
        result.blocks.some((b) => (b as { type?: string }).type === "divider"),
      ).toBe(true);
    });

    it("should keep the body verbatim (no machine-added > prefix) even when it starts with > / contains --- / ##", () => {
      const body = "> quoted line\n\n---\n\n## heading\n\nbody";
      const result = buildSlackPostMessage(
        ["slackUser1"],
        "title",
        "link",
        body,
        "sender_github_username",
      );

      const texts = sectionTexts(result.blocks);
      // body section が元の body と完全一致する = 機械的なプレフィックス付与なし
      expect(texts).toContain(body);
    });

    it("should use 'have' for multiple mentions and join them with spaces", () => {
      const result = buildSlackPostMessage(
        ["slackUser1", "slackUser2"],
        "title",
        "link",
        "body",
        "sender_github_username",
      );

      expect(result.text).toEqual(
        "<@slackUser1> <@slackUser2> have been mentioned at <link|title> by sender_github_username",
      );
    });

    it("should split bodies that exceed the Slack section limit into multiple sections each within 3000 chars", () => {
      const body = "a".repeat(8000);
      const result = buildSlackPostMessage(
        ["slackUser1"],
        "title",
        "link",
        body,
        "sender_github_username",
      );

      const texts = sectionTexts(result.blocks);
      // header + 複数の body chunk
      expect(texts.length).toBeGreaterThan(2);
      for (const t of texts) {
        expect(t.length).toBeLessThanOrEqual(3000);
      }
    });

    it("should omit body section when github body is empty", () => {
      const result = buildSlackPostMessage(
        ["slackUser1"],
        "title",
        "link",
        "",
        "sender_github_username",
      );

      const texts = sectionTexts(result.blocks);
      expect(texts.length).toEqual(1);
      expect(
        result.blocks.some((b) => (b as { type?: string }).type === "divider"),
      ).toBe(false);
    });
  });

  describe("buildSlackReviewSubmittedMessage", () => {
    it.each([
      ["approved", "has been approved"],
      ["changes_requested", "has been requested changes on"],
      ["commented", "has received a review comment on"],
      [undefined, "has received a review comment on"],
    ] as const)("should compose headline for review state '%s'", (state, verb) => {
      const result = buildSlackReviewSubmittedMessage(
        "U_OWNER",
        "<https://example.com/pr/1|#42 PR1>",
        "reviewer_user",
        state,
        "review body",
      );

      const expectedHeadline = `<@U_OWNER> ${verb} <https://example.com/pr/1|#42 PR1> by reviewer_user.`;
      expect(result.text).toEqual(expectedHeadline);
      const texts = sectionTexts(result.blocks);
      expect(texts[0]).toEqual(expectedHeadline);
      expect(texts[1]).toEqual("review body");
    });

    it("should keep review body verbatim (no machine-added > prefix)", () => {
      const body = "> quoted\n\n---\n\n## heading\n\nbody";
      const result = buildSlackReviewSubmittedMessage(
        "U_OWNER",
        "<link|title>",
        "reviewer_user",
        "commented",
        body,
      );

      const texts = sectionTexts(result.blocks);
      expect(texts).toContain(body);
    });

    it("should omit body section when review body is empty or null", () => {
      const result = buildSlackReviewSubmittedMessage(
        "U_OWNER",
        "<link|title>",
        "reviewer_user",
        "approved",
        null,
      );

      const texts = sectionTexts(result.blocks);
      expect(texts.length).toEqual(1);
    });
  });

  describe("buildSlackErrorMessage", () => {
    it("should expose short text fallback and put stack trace in a code-fenced section", () => {
      const e = new Error("dummy error");
      e.stack = "Error: dummy error\n  at line";
      const result = buildSlackErrorMessage(e);

      expect(result.text.includes("internal error")).toBe(true);
      const texts = sectionTexts(result.blocks);
      // headline section + stack section
      expect(texts.length).toBeGreaterThanOrEqual(2);
      const stackSection = texts[texts.length - 1];
      expect(stackSection.startsWith("```")).toBe(true);
      expect(stackSection.endsWith("```")).toBe(true);
      expect(stackSection.includes("dummy error")).toBe(true);
    });
  });
});
