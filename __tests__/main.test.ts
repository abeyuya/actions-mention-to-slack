import {
  convertToSlackUsername,
  execPrReviewRequestedMention,
  execNormalMention,
  AllInputs,
  isUrl,
} from "../src/main";

describe("src/main", () => {
  const dummyContext = {
    repo: { owner: "owner_name", repo: "repo_name" },
    sha: "commit_sha",
  };

  describe("convertToSlackUsername", () => {
    const mapping = {
      github_user_1: "slack_user_1",
      github_user_2: "slack_user_2",
    };

    it("should return hits slack member ids", async () => {
      const mock = {
        loadNameMappingConfig: jest.fn(async () => mapping),
      };

      const result = await convertToSlackUsername(
        ["github_user_1", "github_user_2"],
        mock,
        "",
        "",
        dummyContext
      );

      expect(result).toEqual(["slack_user_1", "slack_user_2"]);
    });

    it("should return empty when no listed github_user", async () => {
      const mock = {
        loadNameMappingConfig: jest.fn(async () => mapping),
      };

      const result = await convertToSlackUsername(
        ["github_user_not_listed"],
        mock,
        "",
        "",
        dummyContext
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
      const githubMock = {
        loadNameMappingConfig: jest.fn().mockResolvedValueOnce(dummyMapping),
      };

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
        githubMock,
        slackMock,
        dummyContext
      );

      expect(slackMock.postToSlack.mock.calls.length).toEqual(1);

      const call = slackMock.postToSlack.mock.calls[0];
      expect(call[0]).toEqual("dummy_url");
      expect(call[1].includes("<@slack_user_1>")).toEqual(true);
      expect(call[1].includes("<pr_url|pr_title>")).toEqual(true);
      expect(call[1].includes("by sender_github_username")).toEqual(true);
    });

    it("should not call postToSlack if requested_user is not listed in mapping", async () => {
      const githubMock = {
        loadNameMappingConfig: jest.fn().mockResolvedValueOnce(dummyMapping),
      };

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
        githubMock,
        slackMock,
        dummyContext
      );

      expect(githubMock.loadNameMappingConfig.mock.calls.length).toEqual(1);
      expect(slackMock.postToSlack.mock.calls.length).toEqual(0);
    });

    it("should call postToSlack if requested_user is team account", async () => {
      const githubMock = {
        loadNameMappingConfig: jest.fn().mockResolvedValueOnce(dummyMapping),
      };

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
        githubMock,
        slackMock,
        dummyContext
      );

      expect(githubMock.loadNameMappingConfig.mock.calls.length).toEqual(1);
      expect(slackMock.postToSlack.mock.calls.length).toEqual(1);
    });
  });

  describe("execNormalMention", () => {
    const dummyInputs: AllInputs = {
      repoToken: "",
      configurationPath: "",
      slackWebhookUrl: "dummy_url",
      iconUrl: "",
      botName: "",
    };

    const dummyMapping = {
      github_user_1: "slack_user_1",
    };

    it("should call postToSlack if requested_user is listed in mapping", async () => {
      const githubMock = {
        loadNameMappingConfig: jest.fn(async () => dummyMapping),
      };

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
        githubMock,
        slackMock,
        dummyContext
      );

      expect(slackMock.postToSlack.mock.calls.length).toEqual(1);

      const call = slackMock.postToSlack.mock.calls[0];
      expect(call[0]).toEqual("dummy_url");
      expect(call[1].includes("<@slack_user_1>")).toEqual(true);
      expect(call[1].includes("<review_comment_url|pr_title>")).toEqual(true);
      expect(call[1].includes("> @github_user_1 LGTM!")).toEqual(true);
      expect(call[1].includes("by sender_github_username")).toEqual(true);
    });

    it("should not call postToSlack if requested_user is not listed in mapping", async () => {
      const githubMock = {
        loadNameMappingConfig: jest.fn(async () => ({
          some_github_user: "some_slack_user_id",
        })),
      };

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
        githubMock,
        slackMock,
        dummyContext
      );

      expect(slackMock.postToSlack.mock.calls.length).toEqual(0);
    });
  });

  describe("isUrl", () => {
    it("true https://github.com/abeyuya/actions-mention-to-slack", () => {
      const result = isUrl(
        "https://github.com/abeyuya/actions-mention-to-slack"
      );
      expect(result).toEqual(true);
    });

    it("false ./actions-mention-to-slack/test.yml", () => {
      const result = isUrl("./actions-mention-to-slack/test.yml");
      expect(result).toEqual(false);
    });
  });
});
