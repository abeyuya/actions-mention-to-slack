import { cloneDeep } from "lodash";

import {
  convertToSlackUsername,
  execPrReviewRequestedMention,
  execNormalMention,
  execApproveMention,
  AllInputs,
  arrayDiff,
} from "../src/main";

import { prApprovePayload } from "./fixture/real-payload-20211024-pr-approve";

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
        mapping
      );

      expect(result).toEqual(["slack_user_1", "slack_user_2"]);
    });

    it("should return empty when no listed github_user", async () => {
      const result = convertToSlackUsername(
        ["github_user_not_listed"],
        mapping
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
      github_team_1: "slack_user_2",
    };

    it("should call postToSlack if requested_user is listed in mapping", async () => {
      const slackMock = {
        postToSlack: jest.fn(),
      };

      const dummyPayload = {
        requested_reviewer: {
          login: "github_user_1",
        },
        pull_request: {
          title: "pr_title",
          html_url: "pr_url",
        },
        sender: {
          login: "sender_github_username",
        },
      };

      await execPrReviewRequestedMention(
        dummyPayload as any,
        dummyInputs,
        dummyMapping,
        slackMock
      );

      expect(slackMock.postToSlack).toHaveBeenCalledTimes(1);

      const call = slackMock.postToSlack.mock.calls[0];
      expect(call[0]).toEqual("dummy_url");
      expect(call[1].includes("<@slack_user_1>")).toEqual(true);
      expect(call[1].includes("<pr_url|pr_title>")).toEqual(true);
      expect(call[1].includes("by sender_github_username")).toEqual(true);
    });

    it("should not call postToSlack if requested_user is not listed in mapping", async () => {
      const slackMock = {
        postToSlack: jest.fn(),
      };

      const dummyPayload = {
        requested_reviewer: {
          login: "github_user_not_linsted",
        },
        pull_request: {
          title: "pr_title",
          html_url: "pr_url",
        },
        sender: {
          login: "sender_github_username",
        },
      };

      await execPrReviewRequestedMention(
        dummyPayload as any,
        dummyInputs,
        dummyMapping,
        slackMock
      );

      expect(slackMock.postToSlack).not.toHaveBeenCalled();
    });

    it("should call postToSlack if requested_user is team account", async () => {
      const slackMock = {
        postToSlack: jest.fn(),
      };

      const dummyPayload = {
        pull_request: {
          title: "pr_title",
          html_url: "pr_url",
        },
        requested_team: {
          name: "github_team_1",
        },
        sender: {
          login: "sender_github_username",
        },
      };

      await execPrReviewRequestedMention(
        dummyPayload as any,
        dummyInputs,
        dummyMapping,
        slackMock
      );

      expect(slackMock.postToSlack).toHaveBeenCalledTimes(1);
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
        postToSlack: jest.fn(),
      };

      const dummyPayload = {
        action: "submitted",
        review: {
          body: "@github_user_1 LGTM!",
          html_url: "review_comment_url",
        },
        pull_request: {
          title: "pr_title",
        },
        sender: {
          login: "sender_github_username",
        },
      };

      await execNormalMention(
        dummyPayload as any,
        dummyInputs,
        dummyMapping,
        slackMock,
        []
      );

      expect(slackMock.postToSlack).toHaveBeenCalledTimes(1);

      const call = slackMock.postToSlack.mock.calls[0];
      expect(call[0]).toEqual("dummy_url");
      expect(call[1].includes("<@slack_user_1>")).toEqual(true);
      expect(call[1].includes("<review_comment_url|pr_title>")).toEqual(true);
      expect(call[1].includes("> @github_user_1 LGTM!")).toEqual(true);
      expect(call[1].includes("by sender_github_username")).toEqual(true);
    });

    it("should not call postToSlack if requested_user is not listed in mapping", async () => {
      const slackMock = {
        postToSlack: jest.fn(),
      };

      const dummyPayload = {
        action: "submitted",
        review: {
          body: "@github_user_1 LGTM!",
          html_url: "review_comment_url",
        },
        pull_request: {
          title: "pr_title",
        },
        sender: {
          login: "sender_github_username",
        },
      };

      await execNormalMention(
        dummyPayload as any,
        dummyInputs,
        {
          some_github_user: "some_slack_user_id",
        },
        slackMock,
        []
      );

      expect(slackMock.postToSlack).not.toHaveBeenCalled();
    });

    describe("with execApproveMention", () => {
      describe("no mention in body", () => {
        it("should not call slack post", async () => {
          const slackMock = {
            postToSlack: jest.fn(),
          };

          await execNormalMention(
            prApprovePayload as any,
            dummyInputs,
            {
              "abeyuya-bot": "pr_owner_slack_user_id",
            },
            slackMock,
            []
          );

          expect(slackMock.postToSlack).not.toHaveBeenCalled();
        });
      });

      describe("another user mention in body", () => {
        it("should call slack post", async () => {
          const slackMock = {
            postToSlack: jest.fn(),
          };

          const overwritePayload = cloneDeep(prApprovePayload);
          overwritePayload.review.body =
            "this is approve comment. @github_user hello";

          await execNormalMention(
            overwritePayload as any,
            dummyInputs,
            {
              "abeyuya-bot": "pr_owner_slack_user_id",
              github_user: "slack_user_id_1",
            },
            slackMock,
            []
          );

          expect(slackMock.postToSlack).toHaveBeenCalledTimes(1);
        });
      });

      describe("pr-owner-user mention in body", () => {
        it("should not call slack post. (because pr-owner-user already mention by execApproveMention)", async () => {
          const slackMock = {
            postToSlack: jest.fn(),
          };

          const overwritePayload = cloneDeep(prApprovePayload);
          overwritePayload.review.body =
            "this is approve comment. @abeyuya-bot hello";

          await execNormalMention(
            overwritePayload as any,
            dummyInputs,
            {
              "abeyuya-bot": "pr_owner_slack_user_id",
            },
            slackMock,
            ["pr_owner_slack_user_id"]
          );

          expect(slackMock.postToSlack).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe("execApproveMention", () => {
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

    describe("real payload test", () => {
      it("should send slack mention", async () => {
        const slackMock = {
          postToSlack: jest.fn(),
        };

        const result = await execApproveMention(
          prApprovePayload as any,
          dummyInputs,
          dummyMapping,
          slackMock
        );

        expect(slackMock.postToSlack).toHaveBeenCalledTimes(1);
        expect(result).toEqual("pr_owner_slack_user");

        const call = slackMock.postToSlack.mock.calls[0];
        expect(call[0]).toEqual("dummy_url");
        expect(call[1]).toMatch("<@pr_owner_slack_user>");
        expect(call[1]).toMatch(
          "<https://github.com/abeyuya/github-actions-test/pull/11#pullrequestreview-787479727|Update mention-to-slack.yml>"
        );
        expect(call[1]).toMatch("by abeyuya");
        expect(call[1]).toMatch("> approve comment");
      });
    });
  });
});
