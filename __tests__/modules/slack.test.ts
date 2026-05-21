import {
  buildSlackCommentToAuthorMessage,
  buildSlackErrorMessage,
  buildSlackPostMessage,
  buildSlackReviewRequestedMessage,
  buildSlackReviewSubmittedMessage,
  CONTINUATION_SUFFIX,
  convertGithubMarkdownToSlackMrkdwn,
  formatIssueRef,
  formatIssueRefLink,
  QUOTE_ATTACHMENT_COLOR,
  SECTION_TEXT_LIMIT,
  splitMrkdwnByLimit,
} from "../../src/modules/slack.js";
import {
  attachmentSectionTexts,
  type QuoteAttachment,
  sectionTexts,
} from "../fixture/slackBlocks.js";

describe("modules/slack", () => {
  describe("formatIssueRef", () => {
    it("renders `[repo#number] title` in the official GitHub Slack style", () => {
      expect(formatIssueRef("monorepo", 71233, "API docs")).toEqual(
        "[monorepo#71233] API docs",
      );
    });
  });

  describe("formatIssueRefLink", () => {
    it("wraps the issue ref in a Slack mrkdwn link", () => {
      expect(
        formatIssueRefLink("https://example.com/pr/42", "repo", 42, "Fix bug"),
      ).toEqual("<https://example.com/pr/42|[repo#42] Fix bug>");
    });
  });

  describe("buildSlackPostMessage", () => {
    it("should keep only the headline in text/blocks and put the body in a grey-colored attachment", () => {
      const result = buildSlackPostMessage(
        ["slackUser1"],
        "repo",
        42,
        "title",
        "https://example.com/c",
        "message",
        "sender_github_username",
      );

      const expectedHeadline =
        "<@slackUser1> sender_github_username mentioned you in <https://example.com/c|[repo#42] title>";
      expect(result.text).toEqual(expectedHeadline);
      expect(sectionTexts(result.blocks)).toEqual([expectedHeadline]);

      expect(result.attachments.length).toEqual(1);
      expect((result.attachments[0] as QuoteAttachment).color).toEqual(
        QUOTE_ATTACHMENT_COLOR,
      );
      expect(attachmentSectionTexts(result.attachments)).toEqual([["message"]]);
    });

    it("should route github body through Slack mrkdwn conversion", () => {
      const result = buildSlackPostMessage(
        ["slackUser1"],
        "repo",
        42,
        "title",
        "https://example.com/c",
        "## heading\n\nbody",
        "sender_github_username",
      );

      expect(attachmentSectionTexts(result.attachments)).toEqual([
        ["*heading*\n\nbody"],
      ]);
    });

    it("should join multiple mentions with spaces and keep the verb invariant", () => {
      const result = buildSlackPostMessage(
        ["slackUser1", "slackUser2"],
        "repo",
        42,
        "title",
        "https://example.com/c",
        "body",
        "sender_github_username",
      );

      expect(result.text).toEqual(
        "<@slackUser1> <@slackUser2> sender_github_username mentioned you in <https://example.com/c|[repo#42] title>",
      );
    });

    it("should split bodies that exceed the Slack section limit into multiple attachment sections each within 3000 chars", () => {
      const body = "a".repeat(8000);
      const result = buildSlackPostMessage(
        ["slackUser1"],
        "repo",
        42,
        "title",
        "https://example.com/c",
        body,
        "sender_github_username",
      );

      const chunks = attachmentSectionTexts(result.attachments)[0];
      expect(chunks.length).toBeGreaterThanOrEqual(3);
      for (const t of chunks) {
        expect(t.length).toBeLessThanOrEqual(3000);
      }
    });

    it("should omit attachments when github body is empty", () => {
      const result = buildSlackPostMessage(
        ["slackUser1"],
        "repo",
        42,
        "title",
        "https://example.com/c",
        "",
        "sender_github_username",
      );

      expect(result.attachments).toEqual([]);
      expect(sectionTexts(result.blocks)).toEqual([result.text]);
    });
  });

  describe("buildSlackReviewRequestedMessage", () => {
    it("composes the headline in official GitHub Slack style without quoting PR body", () => {
      const result = buildSlackReviewRequestedMessage(
        "<@U_REVIEWER>",
        "https://example.com/pr/42",
        "repo",
        42,
        "Fix bug",
        "requester_user",
      );

      const expectedHeadline =
        "<@U_REVIEWER> requester_user requested your review on <https://example.com/pr/42|[repo#42] Fix bug>";
      expect(result.text).toEqual(expectedHeadline);
      expect(sectionTexts(result.blocks)).toEqual([expectedHeadline]);
      expect(result.attachments).toEqual([]);
    });
  });

  describe("buildSlackReviewSubmittedMessage", () => {
    it.each([
      ["approved", "reviewer_user approved"],
      ["changes_requested", "reviewer_user requested changes on"],
      ["commented", "reviewer_user commented on"],
      [undefined, "reviewer_user commented on"],
    ] as const)("should compose headline for review state '%s'", (state, verb) => {
      const result = buildSlackReviewSubmittedMessage(
        "U_OWNER",
        "https://example.com/pr/42",
        "repo",
        42,
        "PR1",
        "reviewer_user",
        state,
        "review body",
      );

      const expectedHeadline = `<@U_OWNER> ${verb} <https://example.com/pr/42|[repo#42] PR1>`;
      expect(result.text).toEqual(expectedHeadline);
      expect(sectionTexts(result.blocks)).toEqual([expectedHeadline]);
      expect(attachmentSectionTexts(result.attachments)).toEqual([
        ["review body"],
      ]);
    });

    it("should omit attachments when review body is empty or null", () => {
      const result = buildSlackReviewSubmittedMessage(
        "U_OWNER",
        "https://example.com/pr/42",
        "repo",
        42,
        "PR1",
        "reviewer_user",
        "approved",
        null,
      );

      expect(result.attachments).toEqual([]);
    });
  });

  describe("buildSlackCommentToAuthorMessage", () => {
    it("should keep only the headline in text/blocks and put the body in a grey-colored attachment", () => {
      const result = buildSlackCommentToAuthorMessage(
        "U_AUTHOR",
        "https://example.com/pr/42",
        "repo",
        42,
        "PR1",
        "commenter_user",
        "looks good",
      );

      const expectedHeadline =
        "<@U_AUTHOR> commenter_user commented on <https://example.com/pr/42|[repo#42] PR1>";
      expect(result.text).toEqual(expectedHeadline);
      expect(sectionTexts(result.blocks)).toEqual([expectedHeadline]);

      expect(result.attachments.length).toEqual(1);
      expect((result.attachments[0] as QuoteAttachment).color).toEqual(
        QUOTE_ATTACHMENT_COLOR,
      );
      expect(attachmentSectionTexts(result.attachments)).toEqual([
        ["looks good"],
      ]);
    });

    it("should omit attachments when the comment body is empty or null", () => {
      const result = buildSlackCommentToAuthorMessage(
        "U_AUTHOR",
        "https://example.com/pr/42",
        "repo",
        42,
        "PR1",
        "commenter_user",
        null,
      );

      expect(result.attachments).toEqual([]);
      expect(sectionTexts(result.blocks)).toEqual([result.text]);
    });
  });

  describe("buildSlackErrorMessage", () => {
    it("should expose short text fallback and put stack trace in a grey-colored attachment", () => {
      const e = new Error("dummy error");
      e.stack = "Error: dummy error\n  at line";
      const result = buildSlackErrorMessage(e);

      expect(result.text.includes("internal error")).toBe(true);
      expect(sectionTexts(result.blocks).length).toEqual(1);
      expect((result.attachments[0] as QuoteAttachment).color).toEqual(
        QUOTE_ATTACHMENT_COLOR,
      );
      const stackSection = attachmentSectionTexts(result.attachments)[0][0];
      expect(stackSection.startsWith("```")).toBe(true);
      expect(stackSection.endsWith("```")).toBe(true);
      expect(stackSection.includes("dummy error")).toBe(true);
    });
  });

  describe("splitMrkdwnByLimit", () => {
    it("should split a single line longer than the limit and mark intermediate chunks with (cont.)", () => {
      const longLine = "a".repeat(SECTION_TEXT_LIMIT + 100);
      const chunks = splitMrkdwnByLimit(longLine);

      expect(chunks.length).toBeGreaterThanOrEqual(2);
      for (const c of chunks) {
        expect(c.length).toBeLessThanOrEqual(SECTION_TEXT_LIMIT);
      }
      for (let i = 0; i < chunks.length - 1; i += 1) {
        expect(chunks[i].endsWith(CONTINUATION_SUFFIX)).toBe(true);
      }
      expect(chunks[chunks.length - 1].endsWith(CONTINUATION_SUFFIX)).toBe(
        false,
      );

      const restored = chunks
        .map((c, i) =>
          i === chunks.length - 1
            ? c
            : c.slice(0, c.length - CONTINUATION_SUFFIX.length),
        )
        .join("");
      expect(restored).toEqual(longLine);
    });

    it("should return the input untouched when within the limit", () => {
      const text = "short text\nwith newline";
      expect(splitMrkdwnByLimit(text)).toEqual([text]);
    });

    it("should return an empty array for an empty input", () => {
      expect(splitMrkdwnByLimit("")).toEqual([]);
    });
  });

  describe("convertGithubMarkdownToSlackMrkdwn", () => {
    // slackify-markdown は強調記号の隣接対策で ZWSP (U+200B) を挿入する。
    // 期待値も実際の出力と揃え、ZWSP を保持していることを明示する。
    const ZWSP = "​";

    it("should convert bold / italic / strikethrough into Slack mrkdwn", () => {
      expect(
        convertGithubMarkdownToSlackMrkdwn("**bold** and _italic_ and ~~s~~"),
      ).toEqual(
        `${ZWSP}*bold*${ZWSP} and ${ZWSP}_italic_${ZWSP} and ${ZWSP}~s~${ZWSP}`,
      );
    });

    it("should convert inline link into Slack link format", () => {
      expect(
        convertGithubMarkdownToSlackMrkdwn("see [docs](https://example.com)"),
      ).toEqual("see <https://example.com|docs>");
    });

    it("should convert heading into bold line", () => {
      expect(convertGithubMarkdownToSlackMrkdwn("## heading\n\nbody")).toEqual(
        "*heading*\n\nbody",
      );
    });

    it("should preserve blockquote prefix", () => {
      expect(convertGithubMarkdownToSlackMrkdwn("> quoted line")).toEqual(
        "> quoted line",
      );
    });

    it("should leave plain text untouched (no trailing newline)", () => {
      expect(convertGithubMarkdownToSlackMrkdwn("plain text")).toEqual(
        "plain text",
      );
    });

    it("should return empty string for null / undefined / empty input", () => {
      expect(convertGithubMarkdownToSlackMrkdwn(null)).toEqual("");
      expect(convertGithubMarkdownToSlackMrkdwn(undefined)).toEqual("");
      expect(convertGithubMarkdownToSlackMrkdwn("")).toEqual("");
    });
  });
});
