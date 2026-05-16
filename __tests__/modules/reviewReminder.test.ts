import { jest } from "@jest/globals";

import {
  buildReviewReminderMessage,
  fetchOpenReviewRequests,
  ReminderEntry,
} from "../../src/modules/reviewReminder.js";

describe("reviewReminder", () => {
  describe("buildReviewReminderMessage", () => {
    it("returns null when entries are empty", () => {
      expect(buildReviewReminderMessage([], "owner/repo")).toBeNull();
    });

    it("renders mapped user with <@id>", () => {
      const entries: ReminderEntry[] = [
        {
          githubName: "alice",
          slackId: "U_ALICE",
          isTeam: false,
          prs: [{ title: "Fix bug", url: "https://example.com/pr/1" }],
        },
      ];

      const msg = buildReviewReminderMessage(entries, "owner/repo");
      expect(msg).toContain("owner/repo");
      expect(msg).toContain("<@U_ALICE>");
      expect(msg).toContain("• <https://example.com/pr/1|Fix bug>");
    });

    it("renders mapped team with <!subteam^id>", () => {
      const entries: ReminderEntry[] = [
        {
          githubName: "team-a",
          slackId: "S_TEAM",
          isTeam: true,
          prs: [{ title: "Feature X", url: "https://example.com/pr/2" }],
        },
      ];

      const msg = buildReviewReminderMessage(entries, "owner/repo");
      expect(msg).toContain("<!subteam^S_TEAM>");
      expect(msg).toContain("• <https://example.com/pr/2|Feature X>");
    });

    it("renders unmapped user with backticked github name", () => {
      const entries: ReminderEntry[] = [
        {
          githubName: "bob",
          isTeam: false,
          prs: [{ title: "Tweak", url: "https://example.com/pr/3" }],
        },
      ];

      const msg = buildReviewReminderMessage(entries, "owner/repo");
      expect(msg).toContain("`bob`");
      expect(msg).not.toContain("<@");
    });

    it("aggregates multiple PRs per reviewer", () => {
      const entries: ReminderEntry[] = [
        {
          githubName: "alice",
          slackId: "U_ALICE",
          isTeam: false,
          prs: [
            { title: "Fix 1", url: "https://example.com/pr/1" },
            { title: "Fix 2", url: "https://example.com/pr/2" },
          ],
        },
      ];

      const msg = buildReviewReminderMessage(entries, "owner/repo") ?? "";
      expect(msg).toContain("<https://example.com/pr/1|Fix 1>");
      expect(msg).toContain("<https://example.com/pr/2|Fix 2>");
    });
  });

  describe("fetchOpenReviewRequests", () => {
    const buildOctokit = (prs: unknown[]) =>
      ({
        paginate: jest.fn(async () => prs),
        rest: { pulls: { list: jest.fn() } },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

    it("groups reviewers across PRs and skips drafts", async () => {
      const octokit = buildOctokit([
        {
          title: "PR1",
          html_url: "https://example.com/pr/1",
          draft: false,
          requested_reviewers: [{ login: "alice" }, { login: "bob" }],
          requested_teams: [],
        },
        {
          title: "PR2",
          html_url: "https://example.com/pr/2",
          draft: false,
          requested_reviewers: [{ login: "alice" }],
          requested_teams: [{ name: "team-a" }],
        },
        {
          title: "Draft PR",
          html_url: "https://example.com/pr/3",
          draft: true,
          requested_reviewers: [{ login: "carol" }],
          requested_teams: [],
        },
      ]);

      const result = await fetchOpenReviewRequests(octokit, "owner", "repo");

      const byName = Object.fromEntries(
        result.map((r) => [r.githubName, r])
      );

      expect(byName["alice"].isTeam).toBe(false);
      expect(byName["alice"].prs).toHaveLength(2);
      expect(byName["bob"].prs).toHaveLength(1);
      expect(byName["team-a"].isTeam).toBe(true);
      expect(byName["team-a"].prs).toHaveLength(1);
      expect(byName["carol"]).toBeUndefined();
    });

    it("returns empty array when no PRs have reviewers", async () => {
      const octokit = buildOctokit([
        {
          title: "PR1",
          html_url: "https://example.com/pr/1",
          draft: false,
          requested_reviewers: [],
          requested_teams: [],
        },
      ]);

      const result = await fetchOpenReviewRequests(octokit, "owner", "repo");
      expect(result).toEqual([]);
    });
  });
});
