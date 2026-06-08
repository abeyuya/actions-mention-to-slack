import { assert, vi } from "vitest";

import {
  aggregateApprovalState,
  buildReviewReminderMessage,
  fetchOpenReviewRequests,
  formatLabels,
  formatRelativeAge,
  type ReminderEntry,
} from "../../src/modules/reviewReminder.js";

const FIXED_NOW = new Date("2026-05-17T12:00:00Z");

const makePr = (overrides: Record<string, unknown> = {}) => ({
  number: 1,
  title: "PR title",
  html_url: "https://example.com/pr/1",
  user: { login: "author_user" },
  draft: false,
  created_at: "2026-05-14T12:00:00Z",
  labels: [],
  requested_reviewers: [],
  requested_teams: [],
  ...overrides,
});

const makeEntryPr = (overrides: Record<string, unknown> = {}) => ({
  number: 1,
  title: "PR title",
  url: "https://example.com/pr/1",
  author: "author_user",
  createdAt: "2026-05-14T12:00:00Z",
  approvalState: "review_required" as const,
  labels: [],
  ...overrides,
});

describe("reviewReminder", () => {
  describe("formatRelativeAge", () => {
    it("returns 'just now' for very recent timestamps", () => {
      expect(
        formatRelativeAge(new Date("2026-05-17T11:59:30Z"), FIXED_NOW),
      ).toBe("just now");
    });

    it("returns minutes for sub-hour ages", () => {
      expect(
        formatRelativeAge(new Date("2026-05-17T11:57:00Z"), FIXED_NOW),
      ).toBe("3m");
    });

    it("returns hours for sub-day ages", () => {
      expect(
        formatRelativeAge(new Date("2026-05-17T07:00:00Z"), FIXED_NOW),
      ).toBe("5h");
    });

    it("returns days for multi-day ages", () => {
      expect(
        formatRelativeAge(new Date("2026-05-14T12:00:00Z"), FIXED_NOW),
      ).toBe("3d");
    });

    it("returns 'just now' when createdAt is in the future", () => {
      expect(
        formatRelativeAge(new Date("2026-05-17T13:00:00Z"), FIXED_NOW),
      ).toBe("just now");
    });
  });

  describe("formatLabels", () => {
    it("returns empty string for no labels", () => {
      expect(formatLabels([])).toBe("");
    });

    it("renders all labels when at or below the display limit", () => {
      expect(formatLabels(["bug", "ui", "priority-high"])).toBe(
        "`bug`, `ui`, `priority-high`",
      );
    });

    it("truncates extra labels with a +N more suffix", () => {
      expect(formatLabels(["a", "b", "c", "d", "e", "f", "g"])).toBe(
        "`a`, `b`, `c`, `d`, `e`, +2 more",
      );
    });
  });

  describe("aggregateApprovalState", () => {
    it("returns review_required when there are no reviews", () => {
      expect(aggregateApprovalState([])).toBe("review_required");
    });

    it("returns approved when the only reviewer approved", () => {
      expect(
        aggregateApprovalState([{ user: { login: "a" }, state: "APPROVED" }]),
      ).toBe("approved");
    });

    it("returns approved when all reviewers approved", () => {
      expect(
        aggregateApprovalState([
          { user: { login: "a" }, state: "APPROVED" },
          { user: { login: "b" }, state: "APPROVED" },
        ]),
      ).toBe("approved");
    });

    it("returns changes_requested when any reviewer requested changes", () => {
      expect(
        aggregateApprovalState([
          { user: { login: "a" }, state: "APPROVED" },
          { user: { login: "b" }, state: "CHANGES_REQUESTED" },
        ]),
      ).toBe("changes_requested");
    });

    it("uses the latest state when a reviewer submitted multiple reviews", () => {
      expect(
        aggregateApprovalState([
          { user: { login: "a" }, state: "COMMENTED" },
          { user: { login: "a" }, state: "APPROVED" },
        ]),
      ).toBe("approved");

      expect(
        aggregateApprovalState([
          { user: { login: "a" }, state: "APPROVED" },
          { user: { login: "a" }, state: "CHANGES_REQUESTED" },
        ]),
      ).toBe("changes_requested");
    });

    it("treats DISMISSED as invalidating the prior decision", () => {
      expect(
        aggregateApprovalState([
          { user: { login: "a" }, state: "CHANGES_REQUESTED" },
          { user: { login: "a" }, state: "DISMISSED" },
        ]),
      ).toBe("review_required");

      expect(
        aggregateApprovalState([
          { user: { login: "a" }, state: "APPROVED" },
          { user: { login: "a" }, state: "DISMISSED" },
          { user: { login: "b" }, state: "APPROVED" },
        ]),
      ).toBe("approved");
    });

    it("ignores COMMENTED-only reviews as no decision", () => {
      expect(
        aggregateApprovalState([{ user: { login: "a" }, state: "COMMENTED" }]),
      ).toBe("review_required");
    });
  });

  describe("buildReviewReminderMessage", () => {
    it("returns null when entries are empty", () => {
      expect(
        buildReviewReminderMessage([], "owner", "repo", FIXED_NOW),
      ).toBeNull();
    });

    it("renders mapped user with <@id> and PR metadata", () => {
      const entries: ReminderEntry[] = [
        {
          githubName: "alice",
          slackId: "U_ALICE",
          isTeam: false,
          prs: [
            makeEntryPr({
              number: 123,
              title: "Fix bug",
              url: "https://example.com/pr/123",
              approvalState: "approved",
              labels: ["bug", "priority-high"],
            }),
          ],
        },
      ];

      const result = buildReviewReminderMessage(
        entries,
        "owner",
        "repo",
        FIXED_NOW,
      );
      assert(result, "expected a non-null payload");
      const { text, blocks } = result;

      expect(text).toContain("owner/repo");
      expect(text).toContain("<@U_ALICE>");
      expect(text).toContain("<https://example.com/pr/123|[repo#123] Fix bug>");
      expect(text).toContain("(author_user)");
      expect(text).toContain("3d old");
      expect(text).toContain(":white_check_mark:");
      expect(text).toContain("approved");
      expect(text).toContain("`bug`");
      expect(text).toContain("`priority-high`");

      expect(blocks[0]).toEqual({
        type: "section",
        text: {
          type: "mrkdwn",
          text: ":eyes: Reviews assigned to you on `owner/repo`",
        },
      });
      expect(blocks[1]).toEqual({ type: "divider" });
      expect(blocks).toHaveLength(3);
    });

    it("renders mapped team with <!subteam^id>", () => {
      const entries: ReminderEntry[] = [
        {
          githubName: "team-a",
          slackId: "S_TEAM",
          isTeam: true,
          prs: [
            makeEntryPr({
              number: 2,
              title: "Feature X",
              url: "https://example.com/pr/2",
            }),
          ],
        },
      ];

      const result = buildReviewReminderMessage(
        entries,
        "owner",
        "repo",
        FIXED_NOW,
      );
      assert(result);
      expect(result.text).toContain("<!subteam^S_TEAM>");
      expect(result.text).toContain(
        "<https://example.com/pr/2|[repo#2] Feature X>",
      );
    });

    it("renders unmapped user with backticked github name", () => {
      const entries: ReminderEntry[] = [
        {
          githubName: "bob",
          isTeam: false,
          prs: [makeEntryPr({ number: 3, title: "Tweak" })],
        },
      ];

      const result = buildReviewReminderMessage(
        entries,
        "owner",
        "repo",
        FIXED_NOW,
      );
      assert(result);
      expect(result.text).toContain("`bob`");
      expect(result.text).not.toContain("<@");
    });

    it("renders distinct approval state emoji and label", () => {
      const entries: ReminderEntry[] = [
        {
          githubName: "alice",
          slackId: "U_ALICE",
          isTeam: false,
          prs: [
            makeEntryPr({
              number: 10,
              approvalState: "approved",
              url: "https://example.com/pr/10",
            }),
            makeEntryPr({
              number: 11,
              approvalState: "changes_requested",
              url: "https://example.com/pr/11",
            }),
            makeEntryPr({
              number: 12,
              approvalState: "review_required",
              url: "https://example.com/pr/12",
            }),
          ],
        },
      ];

      const result = buildReviewReminderMessage(
        entries,
        "owner",
        "repo",
        FIXED_NOW,
      );
      assert(result);
      expect(result.text).toContain(":white_check_mark: approved");
      expect(result.text).toContain(":warning: changes requested");
      expect(result.text).toContain(":hourglass_flowing_sand: review required");
    });

    it("truncates long label lists with +N more", () => {
      const entries: ReminderEntry[] = [
        {
          githubName: "alice",
          isTeam: false,
          prs: [
            makeEntryPr({
              labels: ["a", "b", "c", "d", "e", "f", "g"],
            }),
          ],
        },
      ];

      const result = buildReviewReminderMessage(
        entries,
        "owner",
        "repo",
        FIXED_NOW,
      );
      assert(result);
      expect(result.text).toContain("+2 more");
    });

    it("emits one section block per reviewer entry plus header and divider", () => {
      const entries: ReminderEntry[] = [
        {
          githubName: "alice",
          slackId: "U_ALICE",
          isTeam: false,
          prs: [makeEntryPr({ number: 1 })],
        },
        {
          githubName: "bob",
          isTeam: false,
          prs: [makeEntryPr({ number: 2, url: "https://example.com/pr/2" })],
        },
      ];

      const result = buildReviewReminderMessage(
        entries,
        "owner",
        "repo",
        FIXED_NOW,
      );
      assert(result);
      expect(result.blocks).toHaveLength(4);
      expect(result.blocks[2]).toMatchObject({
        type: "section",
        text: { type: "mrkdwn" },
      });
      expect(result.blocks[3]).toMatchObject({
        type: "section",
        text: { type: "mrkdwn" },
      });
    });
  });

  describe("fetchOpenReviewRequests", () => {
    const buildOctokit = (
      prs: unknown[],
      reviewsByPr: Record<number, unknown[]> = {},
    ) => {
      const listReviews = vi.fn(
        async ({ pull_number }: { pull_number: number }) => ({
          data: reviewsByPr[pull_number] ?? [],
        }),
      );
      return {
        client: {
          paginate: vi.fn(async () => prs),
          rest: { pulls: { list: vi.fn(), listReviews } },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        listReviews,
      };
    };

    it("groups reviewers across PRs, skips drafts, and attaches approval state", async () => {
      const { client, listReviews } = buildOctokit(
        [
          makePr({
            number: 1,
            title: "PR1",
            html_url: "https://example.com/pr/1",
            created_at: "2026-05-14T12:00:00Z",
            labels: [{ name: "bug" }, { name: "ui" }],
            requested_reviewers: [{ login: "alice" }, { login: "bob" }],
          }),
          makePr({
            number: 2,
            title: "PR2",
            html_url: "https://example.com/pr/2",
            created_at: "2026-05-17T07:00:00Z",
            labels: [],
            requested_reviewers: [{ login: "alice" }],
            requested_teams: [{ name: "team-a" }],
          }),
          makePr({
            number: 3,
            title: "Draft PR",
            html_url: "https://example.com/pr/3",
            draft: true,
            requested_reviewers: [{ login: "carol" }],
          }),
          makePr({
            number: 4,
            title: "No reviewers",
            html_url: "https://example.com/pr/4",
            requested_reviewers: [],
            requested_teams: [],
          }),
        ],
        {
          1: [{ user: { login: "x" }, state: "APPROVED" }],
          2: [{ user: { login: "y" }, state: "CHANGES_REQUESTED" }],
        },
      );

      const result = await fetchOpenReviewRequests(client, "owner", "repo");

      // draft / レビュアーなし PR は listReviews を呼ばない
      expect(listReviews).toHaveBeenCalledTimes(2);

      const byName = Object.fromEntries(result.map((r) => [r.githubName, r]));

      expect(byName.alice.isTeam).toBe(false);
      expect(byName.alice.prs).toHaveLength(2);

      const pr1 = byName.alice.prs.find((p) => p.number === 1);
      assert(pr1);
      expect(pr1.title).toBe("PR1");
      expect(pr1.url).toBe("https://example.com/pr/1");
      expect(pr1.author).toBe("author_user");
      expect(pr1.createdAt).toBe("2026-05-14T12:00:00Z");
      // alice / bob が pending として残るため、x の APPROVED だけでは approved にならない
      expect(pr1.approvalState).toBe("review_required");
      expect(pr1.labels).toEqual(["bug", "ui"]);

      const pr2 = byName.alice.prs.find((p) => p.number === 2);
      assert(pr2);
      expect(pr2.approvalState).toBe("changes_requested");
      expect(pr2.labels).toEqual([]);

      expect(byName.bob.prs).toHaveLength(1);
      expect(byName["team-a"].isTeam).toBe(true);
      expect(byName["team-a"].prs).toHaveLength(1);
      expect(byName.carol).toBeUndefined();
    });

    it("returns empty array when no PRs have reviewers", async () => {
      const { client, listReviews } = buildOctokit([
        makePr({ requested_reviewers: [], requested_teams: [] }),
      ]);

      const result = await fetchOpenReviewRequests(client, "owner", "repo");
      expect(result).toEqual([]);
      expect(listReviews).not.toHaveBeenCalled();
    });

    it("falls back to review_required when listReviews throws for a PR", async () => {
      const listReviews = vi.fn(
        async ({ pull_number }: { pull_number: number }) => {
          if (pull_number === 1) throw new Error("rate limit");
          return {
            data: [{ user: { login: "x" }, state: "CHANGES_REQUESTED" }],
          };
        },
      );
      const client = {
        paginate: vi.fn(async () => [
          makePr({
            number: 1,
            requested_reviewers: [{ login: "alice" }],
          }),
          makePr({
            number: 2,
            requested_reviewers: [{ login: "alice" }],
          }),
        ]),
        rest: { pulls: { list: vi.fn(), listReviews } },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      const result = await fetchOpenReviewRequests(client, "owner", "repo");
      const alice = result.find((r) => r.githubName === "alice");
      assert(alice);

      const pr1 = alice.prs.find((p) => p.number === 1);
      assert(pr1);
      expect(pr1.approvalState).toBe("review_required");

      const pr2 = alice.prs.find((p) => p.number === 2);
      assert(pr2);
      expect(pr2.approvalState).toBe("changes_requested");
    });

    it("excludes PRs whose title contains an ignored term (partial, case-insensitive, OR)", async () => {
      const { client, listReviews } = buildOctokit([
        makePr({
          number: 1,
          title: "[WIP] add feature",
          requested_reviewers: [{ login: "alice" }],
        }),
        makePr({
          number: 2,
          title: "Release v1.2.3",
          requested_reviewers: [{ login: "bob" }],
        }),
        makePr({
          number: 3,
          title: "Normal change",
          requested_reviewers: [{ login: "carol" }],
        }),
      ]);

      // "wip" は大文字小文字を無視した部分一致、複数 term は OR で評価される
      const result = await fetchOpenReviewRequests(client, "owner", "repo", [
        "wip",
        "release",
      ]);

      const names = result.map((r) => r.githubName);
      expect(names).toEqual(["carol"]);
      // 除外された PR では listReviews を呼ばない (carol の PR のみ)
      expect(listReviews).toHaveBeenCalledTimes(1);
    });

    it("matches ignored terms exactly as well (full title)", async () => {
      const { client } = buildOctokit([
        makePr({
          number: 1,
          title: "skip",
          requested_reviewers: [{ login: "alice" }],
        }),
      ]);

      const result = await fetchOpenReviewRequests(client, "owner", "repo", [
        "skip",
      ]);
      expect(result).toEqual([]);
    });

    it("keeps all PRs when ignored terms are not provided", async () => {
      const { client } = buildOctokit([
        makePr({
          number: 1,
          title: "[WIP] add feature",
          requested_reviewers: [{ login: "alice" }],
        }),
      ]);

      const result = await fetchOpenReviewRequests(client, "owner", "repo");
      expect(result.map((r) => r.githubName)).toEqual(["alice"]);
    });
  });

  describe("buildReviewReminderMessage section splitting", () => {
    it("splits a reviewer's section across multiple blocks when the text limit is exceeded", () => {
      const longTitle = "x".repeat(200);
      const prs = Array.from({ length: 60 }, (_, i) =>
        makeEntryPr({
          number: i + 1,
          title: longTitle,
          url: `https://example.com/pr/${i + 1}`,
        }),
      );
      const entries: ReminderEntry[] = [
        {
          githubName: "alice",
          slackId: "U_ALICE",
          isTeam: false,
          prs,
        },
      ];

      const result = buildReviewReminderMessage(
        entries,
        "owner",
        "repo",
        FIXED_NOW,
      );
      assert(result);
      // header section + divider + 複数の reviewer section (分割される)
      const reviewerBlocks = result.blocks.slice(2) as Array<{
        type: string;
        text: { type: string; text: string };
      }>;
      expect(reviewerBlocks.length).toBeGreaterThan(1);
      for (const b of reviewerBlocks) {
        expect(b.text.text.length).toBeLessThanOrEqual(3000);
      }
      // 2 つ目以降の section は "(cont.)" マーカーで始まる
      expect(reviewerBlocks[1].text.text.startsWith("<@U_ALICE> (cont.)")).toBe(
        true,
      );
    });
  });
});
