import { warning } from "@actions/core";
import type { context } from "@actions/github";
import { vi } from "vitest";

import {
  type AllInputs,
  arrayDiff,
  convertToSlackUsername,
  execCommentToAuthor,
  execNormalMention,
  execPostError,
  execPrReviewRequestedMention,
  execReviewReminder,
  execReviewSubmittedMention,
} from "../src/main.js";

import { prApprovePayload } from "./fixture/real-payload-20211024-pr-approve.js";
import { attachmentSectionTexts } from "./fixture/slackBlocks.js";

vi.mock("@actions/core", async () => {
  const actual =
    await vi.importActual<typeof import("@actions/core")>("@actions/core");
  return {
    ...actual,
    warning: vi.fn(),
    debug: vi.fn(),
    setFailed: vi.fn(),
  };
});

describe("src/main", () => {
  describe("arrayDiff", () => {
    it("should return empty array when the same array is given", () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3];
      expect(arrayDiff(a, b)).toEqual([]);
    });

    it("should return empty array when b is big", () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3, 4];
      expect(arrayDiff(a, b)).toEqual([]);
    });

    it("should return diff array when a is big", () => {
      const a = [1, 2, 3, 4];
      const b = [1, 2, 3];
      expect(arrayDiff(a, b)).toEqual([4]);
    });
  });

  describe("convertToSlackUsername", () => {
    const mapping = {
      github_user_1: "slack_user_1",
      github_user_2: "slack_user_2",
    };

    it("should return hits slack member ids", async () => {
      const result = convertToSlackUsername(
        ["github_user_1", "github_user_2"],
        mapping,
      );

      expect(result).toEqual(["slack_user_1", "slack_user_2"]);
    });

    it("should return empty when no listed github_user", async () => {
      const result = convertToSlackUsername(
        ["github_user_not_listed"],
        mapping,
      );

      expect(result).toEqual([]);
    });
  });

  describe("execPrReviewRequestedMention", () => {
    const dummyInputs: AllInputs = {
      repoToken: "",
      configurationPath: "",
      slackWebhookUrl: "dummy_url",
      iconUrl: "",
      botName: "",
    };

    const dummyMapping = {
      github_user_1: "slack_user_1",
      github_team_1: "slack_usergroup_1",
    };

    it("should call postToSlack if requested_user is listed in mapping", async () => {
      const slackMock = {
        postToSlack: vi.fn(),
      };

      const dummyPayload: Partial<typeof context.payload> = {
        requested_reviewer: {
          login: "github_user_1",
        },
        pull_request: {
          title: "pr_title",
          html_url: "pr_url",
          number: 1,
        },
        repository: {
          full_name: "abeyuya/github-actions-test",
          name: "github-actions-test",
          owner: {
            login: "abeyuya",
          },
        },
        sender: {
          login: "sender_github_username",
          type: "sender_type",
        },
      };

      await execPrReviewRequestedMention(
        dummyPayload,
        dummyInputs,
        dummyMapping,
        slackMock,
      );

      expect(slackMock.postToSlack).toHaveBeenCalledTimes(1);

      const call = slackMock.postToSlack.mock.calls[0];
      expect(call[0]).toEqual("dummy_url");
      expect(call[1].includes("<@slack_user_1>")).toEqual(true);
      expect(call[1].includes("<pr_url|pr_title>")).toEqual(true);
      expect(call[1].includes("by sender_github_username")).toEqual(true);
      expect(call[1].includes("on abeyuya/github-actions-test")).toEqual(true);
    });

    it("should not call postToSlack if requested_user is not listed in mapping", async () => {
      const slackMock = {
        postToSlack: vi.fn(),
      };

      const dummyPayload: Partial<typeof context.payload> = {
        requested_reviewer: {
          login: "github_user_not_linsted",
        },
        pull_request: {
          title: "pr_title",
          html_url: "pr_url",
          number: 1,
        },
        repository: {
          full_name: "abeyuya/github-actions-test",
          name: "github-actions-test",
          owner: {
            login: "abeyuya",
          },
        },
        sender: {
          login: "sender_github_username",
          type: "sender_type",
        },
      };

      await execPrReviewRequestedMention(
        dummyPayload,
        dummyInputs,
        dummyMapping,
        slackMock,
      );

      expect(slackMock.postToSlack).not.toHaveBeenCalled();
    });

    it("should call postToSlack if requested_user is team account", async () => {
      const slackMock = {
        postToSlack: vi.fn(),
      };

      const dummyPayload: Partial<typeof context.payload> = {
        pull_request: {
          title: "pr_title",
          html_url: "pr_url",
          number: 1,
        },
        repository: {
          full_name: "abeyuya/github-actions-test",
          name: "github-actions-test",
          owner: {
            login: "abeyuya",
          },
        },
        requested_team: {
          name: "github_team_1",
        },
        sender: {
          login: "sender_github_username",
          type: "sender_type",
        },
      };

      await execPrReviewRequestedMention(
        dummyPayload,
        dummyInputs,
        dummyMapping,
        slackMock,
      );

      expect(slackMock.postToSlack).toHaveBeenCalledTimes(1);

      const call = slackMock.postToSlack.mock.calls[0];
      expect(call[0]).toEqual("dummy_url");
      expect(call[1].includes("<!subteam^slack_usergroup_1>")).toEqual(true);
      expect(call[1].includes("<pr_url|pr_title>")).toEqual(true);
      expect(call[1].includes("by sender_github_username")).toEqual(true);
      expect(call[1].includes("on abeyuya/github-actions-test")).toEqual(true);
    });
  });

  describe("execNormalMention", () => {
    const dummyInputs: AllInputs = {
      repoToken: "",
      configurationPath: "./path/to/yaml",
      slackWebhookUrl: "dummy_url",
      iconUrl: "",
      botName: "",
    };

    const dummyMapping = {
      github_user_1: "slack_user_1",
    };

    it("should call postToSlack if requested_user is listed in mapping", async () => {
      const slackMock = {
        postToSlack: vi.fn(),
      };

      const dummyPayload: Partial<typeof context.payload> = {
        action: "submitted",
        review: {
          body: "@github_user_1 LGTM!",
          html_url: "review_comment_url",
        },
        pull_request: {
          title: "pr_title",
          number: 1,
        },
        sender: {
          login: "sender_github_username",
          type: "sender_type",
        },
      };

      await execNormalMention(
        dummyPayload,
        dummyInputs,
        dummyMapping,
        slackMock,
        [],
      );

      expect(slackMock.postToSlack).toHaveBeenCalledTimes(1);

      const call = slackMock.postToSlack.mock.calls[0];
      expect(call[0]).toEqual("dummy_url");
      expect(call[1].includes("<@slack_user_1>")).toEqual(true);
      expect(call[1].includes("<review_comment_url|pr_title>")).toEqual(true);
      expect(call[1].includes("by sender_github_username")).toEqual(true);
      // body should not be quoted with > any more, and should live in an attachment
      expect(call[1].includes("> @github_user_1 LGTM!")).toEqual(false);
      expect(attachmentSectionTexts(call[2].attachments)).toEqual([
        ["@github_user_1 LGTM!"],
      ]);
    });

    it("should not call postToSlack if requested_user is not listed in mapping", async () => {
      const slackMock = {
        postToSlack: vi.fn(),
      };

      const dummyPayload: Partial<typeof context.payload> = {
        action: "submitted",
        review: {
          body: "@github_user_1 LGTM!",
          html_url: "review_comment_url",
        },
        pull_request: {
          title: "pr_title",
          number: 1,
        },
        sender: {
          login: "sender_github_username",
          type: "sender_type",
        },
      };

      await execNormalMention(
        dummyPayload,
        dummyInputs,
        {
          some_github_user: "some_slack_user_id",
        },
        slackMock,
        [],
      );

      expect(slackMock.postToSlack).not.toHaveBeenCalled();
    });

    describe("with execReviewSubmittedMention", () => {
      describe("no mention in body", () => {
        it("should not call slack post", async () => {
          const slackMock = {
            postToSlack: vi.fn(),
          };

          await execNormalMention(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            prApprovePayload as any,
            dummyInputs,
            {
              "abeyuya-bot": "pr_owner_slack_user_id",
            },
            slackMock,
            [],
          );

          expect(slackMock.postToSlack).not.toHaveBeenCalled();
        });
      });

      describe("another user mention in body", () => {
        it("should call slack post", async () => {
          const slackMock = {
            postToSlack: vi.fn(),
          };

          const overwritePayload = structuredClone(prApprovePayload);
          overwritePayload.review.body =
            "this is approve comment. @github_user hello";

          await execNormalMention(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            overwritePayload as any,
            dummyInputs,
            {
              "abeyuya-bot": "pr_owner_slack_user_id",
              github_user: "slack_user_id_1",
            },
            slackMock,
            [],
          );

          expect(slackMock.postToSlack).toHaveBeenCalledTimes(1);
        });
      });

      describe("pr-owner-user mention in body", () => {
        it("should not call slack post. (because pr-owner-user already mention by execReviewSubmittedMention)", async () => {
          const slackMock = {
            postToSlack: vi.fn(),
          };

          const overwritePayload = structuredClone(prApprovePayload);
          overwritePayload.review.body =
            "this is approve comment. @abeyuya-bot hello";

          await execNormalMention(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            overwritePayload as any,
            dummyInputs,
            {
              "abeyuya-bot": "pr_owner_slack_user_id",
            },
            slackMock,
            ["pr_owner_slack_user_id"],
          );

          expect(slackMock.postToSlack).not.toHaveBeenCalled();
        });
      });
    });

    describe("unsupported event", () => {
      it.each([
        "closed",
        "reopened",
        "ready_for_review",
        "synchronize",
      ])("should not call postToSlack for pull_request.%s", async (action) => {
        const slackMock = { postToSlack: vi.fn() };

        const dummyPayload: Partial<typeof context.payload> = {
          action,
          pull_request: {
            body: "@github_user_1 hi",
            title: "pr_title",
            html_url: "pr_url",
            number: 1,
          },
          sender: {
            login: "sender_github_username",
            type: "User",
          },
        };

        await execNormalMention(
          dummyPayload,
          dummyInputs,
          dummyMapping,
          slackMock,
          [],
        );

        expect(slackMock.postToSlack).not.toHaveBeenCalled();
      });
    });
  });

  describe("execReviewSubmittedMention", () => {
    const dummyInputs: AllInputs = {
      repoToken: "",
      configurationPath: "",
      slackWebhookUrl: "dummy_url",
      iconUrl: "",
      botName: "",
    };

    const dummyMapping = {
      "abeyuya-bot": "pr_owner_slack_user",
    };

    it.each([
      {
        state: "approved",
        body: "approve comment",
        expectedPhrase: "has been approved by",
      },
      {
        state: "changes_requested",
        body: "please fix this",
        expectedPhrase: "has changes requested by",
      },
      {
        state: "commented",
        body: "just a comment",
        expectedPhrase: "received a review comment from",
      },
    ])("should send slack mention with $state wording", async ({
      state,
      body,
      expectedPhrase,
    }) => {
      const slackMock = {
        postToSlack: vi.fn(),
      };

      const overwritePayload = structuredClone(prApprovePayload);
      overwritePayload.review.state = state;
      overwritePayload.review.body = body;

      const result = await execReviewSubmittedMention(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        overwritePayload as any,
        dummyInputs,
        dummyMapping,
        slackMock,
      );

      expect(slackMock.postToSlack).toHaveBeenCalledTimes(1);
      expect(result).toEqual("pr_owner_slack_user");

      const call = slackMock.postToSlack.mock.calls[0];
      expect(call[0]).toEqual("dummy_url");
      expect(call[1]).toMatch("<@pr_owner_slack_user>");
      expect(call[1]).toMatch(expectedPhrase);
      expect(call[1]).toMatch(
        "<https://github.com/abeyuya/github-actions-test/pull/11#pullrequestreview-787479727|Update mention-to-slack.yml>",
      );
      expect(call[1]).toMatch("abeyuya");
      expect(attachmentSectionTexts(call[2].attachments)).toEqual([[body]]);
      expect(call[1]).not.toMatch(`> ${body}`);
    });

    describe("when the reviewer is the PR author (self-review)", () => {
      it("should not post to slack and return null", async () => {
        const slackMock = {
          postToSlack: vi.fn(),
        };

        const overwritePayload = structuredClone(prApprovePayload);
        overwritePayload.sender.login = "abeyuya-bot";

        const result = await execReviewSubmittedMention(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          overwritePayload as any,
          dummyInputs,
          dummyMapping,
          slackMock,
        );

        expect(slackMock.postToSlack).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });
    });

    describe("when review action is unsupported (e.g. edited / dismissed)", () => {
      it.each([
        "edited",
        "dismissed",
      ])("should not post to slack and return null for %s", async (action) => {
        const slackMock = {
          postToSlack: vi.fn(),
        };

        const overwritePayload = structuredClone(prApprovePayload);
        overwritePayload.action = action;

        const result = await execReviewSubmittedMention(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          overwritePayload as any,
          dummyInputs,
          dummyMapping,
          slackMock,
        );

        expect(slackMock.postToSlack).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });
    });
  });

  describe("execCommentToAuthor", () => {
    const dummyInputs: AllInputs = {
      repoToken: "",
      configurationPath: "",
      slackWebhookUrl: "dummy_url",
      iconUrl: "",
      botName: "",
    };

    const dummyMapping = {
      pr_author_github: "pr_author_slack",
    };

    const buildIssueCommentOnPrPayload = (
      overrides: {
        action?: string;
        authorLogin?: string;
        senderLogin?: string;
        senderType?: string;
        body?: string;
      } = {},
    ): Partial<typeof context.payload> => ({
      action: overrides.action ?? "created",
      issue: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pull_request: { html_url: "pr_url" } as any,
        user: { login: overrides.authorLogin ?? "pr_author_github" },
        title: "pr_title",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      comment: {
        body: overrides.body ?? "great work!",
        html_url: "comment_url",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      sender: {
        login: overrides.senderLogin ?? "commenter_github",
        type: overrides.senderType ?? "User",
      },
    });

    it("should notify the PR author for an issue_comment on a PR", async () => {
      const slackMock = { postToSlack: vi.fn() };
      const payload = buildIssueCommentOnPrPayload({ body: "looks good" });

      const result = await execCommentToAuthor(
        payload,
        dummyInputs,
        dummyMapping,
        slackMock,
      );

      expect(slackMock.postToSlack).toHaveBeenCalledTimes(1);
      expect(result).toEqual("pr_author_slack");

      const call = slackMock.postToSlack.mock.calls[0];
      expect(call[0]).toEqual("dummy_url");
      expect(call[1]).toMatch("<@pr_author_slack>");
      expect(call[1]).toMatch("received a comment from commenter_github");
      expect(call[1]).toMatch("<comment_url|pr_title>");
      expect(sectionTexts(call[2].blocks)).toContain("looks good");
    });

    it("should not notify for a pull_request_review_comment (delegated to execReviewSubmittedMention)", async () => {
      const slackMock = { postToSlack: vi.fn() };
      const payload: Partial<typeof context.payload> = {
        action: "created",
        pull_request: {
          user: { login: "pr_author_github" },
          title: "pr_title",
          number: 1,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        comment: { body: "inline", html_url: "review_comment_url" } as any,
        sender: { login: "commenter_github", type: "User" },
      };

      const result = await execCommentToAuthor(
        payload,
        dummyInputs,
        dummyMapping,
        slackMock,
      );

      expect(slackMock.postToSlack).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("should not notify for a comment on an Issue (no pull_request field)", async () => {
      const slackMock = { postToSlack: vi.fn() };
      const payload: Partial<typeof context.payload> = {
        action: "created",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        issue: {
          user: { login: "pr_author_github" },
          title: "issue_title",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        comment: {
          body: "hi",
          html_url: "comment_url",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        sender: { login: "commenter_github", type: "User" },
      };

      const result = await execCommentToAuthor(
        payload,
        dummyInputs,
        dummyMapping,
        slackMock,
      );

      expect(slackMock.postToSlack).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("should not notify when the commenter is the PR author (self-comment)", async () => {
      const slackMock = { postToSlack: vi.fn() };
      const payload = buildIssueCommentOnPrPayload({
        senderLogin: "pr_author_github",
      });

      const result = await execCommentToAuthor(
        payload,
        dummyInputs,
        dummyMapping,
        slackMock,
      );

      expect(slackMock.postToSlack).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("should not notify when the sender is a Bot by default", async () => {
      const slackMock = { postToSlack: vi.fn() };
      const payload = buildIssueCommentOnPrPayload({
        senderLogin: "dependabot[bot]",
        senderType: "Bot",
      });

      const result = await execCommentToAuthor(
        payload,
        dummyInputs,
        dummyMapping,
        slackMock,
      );

      expect(slackMock.postToSlack).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("should notify when the sender is a Bot and notifyBotComment is true", async () => {
      const slackMock = { postToSlack: vi.fn() };
      const payload = buildIssueCommentOnPrPayload({
        senderLogin: "dependabot[bot]",
        senderType: "Bot",
      });

      const result = await execCommentToAuthor(
        payload,
        { ...dummyInputs, notifyBotComment: true },
        dummyMapping,
        slackMock,
      );

      expect(slackMock.postToSlack).toHaveBeenCalledTimes(1);
      expect(result).toEqual("pr_author_slack");
    });

    it("should not notify when the PR author is not in the mapping", async () => {
      const slackMock = { postToSlack: vi.fn() };
      const payload = buildIssueCommentOnPrPayload({
        authorLogin: "unmapped_github_user",
      });

      const result = await execCommentToAuthor(
        payload,
        dummyInputs,
        {},
        slackMock,
      );

      expect(slackMock.postToSlack).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("should not notify for an unsupported action (e.g. deleted)", async () => {
      const slackMock = { postToSlack: vi.fn() };
      const payload = buildIssueCommentOnPrPayload({ action: "deleted" });

      const result = await execCommentToAuthor(
        payload,
        dummyInputs,
        dummyMapping,
        slackMock,
      );

      expect(slackMock.postToSlack).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("should not notify when an existing comment is edited (avoid re-notifying)", async () => {
      const slackMock = { postToSlack: vi.fn() };
      const payload = buildIssueCommentOnPrPayload({ action: "edited" });

      const result = await execCommentToAuthor(
        payload,
        dummyInputs,
        dummyMapping,
        slackMock,
      );

      expect(slackMock.postToSlack).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    describe("with execNormalMention (deduplication)", () => {
      it("execNormalMention skips PR author when their slackId is in ignoreSlackIds", async () => {
        const slackMock = { postToSlack: vi.fn() };
        const payload = buildIssueCommentOnPrPayload({
          body: "@pr_author_github please take a look",
        });

        await execNormalMention(payload, dummyInputs, dummyMapping, slackMock, [
          "pr_author_slack",
        ]);

        expect(slackMock.postToSlack).not.toHaveBeenCalled();
      });
    });
  });

  describe("execReviewReminder", () => {
    const dummyInputs: AllInputs = {
      repoToken: "",
      configurationPath: "",
      slackWebhookUrl: "dummy_url",
      iconUrl: "",
      botName: "",
    };

    const buildOctokit = (
      prs: unknown[],
      reviewsByPr: Record<number, unknown[]> = {},
    ) =>
      ({
        paginate: vi.fn(async () => prs),
        rest: {
          pulls: {
            list: vi.fn(),
            listReviews: vi.fn(
              async ({ pull_number }: { pull_number: number }) => ({
                data: reviewsByPr[pull_number] ?? [],
              }),
            ),
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

    it("posts an aggregated message including mapped and unmapped reviewers", async () => {
      const slackMock = { postToSlack: vi.fn() };
      const octokit = buildOctokit([
        {
          number: 42,
          title: "PR1",
          html_url: "https://example.com/pr/1",
          draft: false,
          created_at: "2026-05-14T12:00:00Z",
          labels: [{ name: "bug" }],
          requested_reviewers: [{ login: "github_user_1" }, { login: "ghost" }],
          requested_teams: [],
        },
      ]);

      await execReviewReminder(
        dummyInputs,
        { github_user_1: "slack_user_1" },
        slackMock,
        octokit,
        "owner",
        "repo",
      );

      expect(slackMock.postToSlack).toHaveBeenCalledTimes(1);
      const call = slackMock.postToSlack.mock.calls[0];
      expect(call[0]).toEqual("dummy_url");
      expect(call[1]).toMatch("<@slack_user_1>");
      expect(call[1]).toMatch("`ghost`");
      expect(call[1]).toMatch("<https://example.com/pr/1|#42 PR1>");
      expect(call[2]).toMatchObject({
        blocks: expect.any(Array),
      });
      expect(call[2].blocks.length).toBeGreaterThan(0);
    });

    it("does not post when there are no pending reviews", async () => {
      const slackMock = { postToSlack: vi.fn() };
      const octokit = buildOctokit([
        {
          number: 9,
          title: "PR without reviewers",
          html_url: "https://example.com/pr/9",
          draft: false,
          created_at: "2026-05-17T12:00:00Z",
          labels: [],
          requested_reviewers: [],
          requested_teams: [],
        },
      ]);

      await execReviewReminder(
        dummyInputs,
        {},
        slackMock,
        octokit,
        "owner",
        "repo",
      );

      expect(slackMock.postToSlack).not.toHaveBeenCalled();
    });
  });

  describe("execPostError", () => {
    const dummyInputs: AllInputs = {
      repoToken: "",
      configurationPath: "",
      slackWebhookUrl: "dummy_url",
      iconUrl: "",
      botName: "",
    };

    beforeEach(() => {
      vi.mocked(warning).mockClear();
    });

    it("posts the error message to Slack when postToSlack succeeds", async () => {
      const slackMock = {
        postToSlack: vi.fn().mockResolvedValue("ok"),
      };

      await execPostError(new Error("boom"), dummyInputs, slackMock);

      expect(slackMock.postToSlack).toHaveBeenCalledTimes(1);
      expect(slackMock.postToSlack.mock.calls[0][0]).toEqual("dummy_url");
    });

    it("does not throw and logs a warning when postToSlack rejects", async () => {
      const slackMock = {
        postToSlack: vi.fn().mockRejectedValue(new Error("slack down")),
      };

      await expect(
        execPostError(new Error("boom"), dummyInputs, slackMock),
      ).resolves.toBeUndefined();

      const failureWarnings = vi
        .mocked(warning)
        .mock.calls.filter(
          (args) =>
            typeof args[0] === "string" &&
            args[0].includes("Failed to post error to Slack"),
        );
      expect(failureWarnings.length).toBeGreaterThanOrEqual(1);
      expect(failureWarnings[0][0]).toMatch("slack down");
    });
  });
});
