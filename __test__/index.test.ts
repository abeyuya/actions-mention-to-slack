import {
  convertToSlackUsername,
  execPrReviewRequestedMention,
  AllInputs
} from "../src/index";

describe("src/index", () => {
  describe("convertToSlackUsername", () => {
    const mapping = {
      github_user_1: "slack_user_1",
      github_user_2: "slack_user_2"
    };

    it("should return hits slack member ids", async () => {
      const mock = {
        loadNameMappingConfig: jest.fn(async () => mapping)
      };

      const result = await convertToSlackUsername(
        ["github_user_1", "github_user_2"],
        mock,
        "",
        ""
      );

      expect(result).toEqual(["slack_user_1", "slack_user_2"]);
    });
  });

  describe("execPrReviewRequestedMention", () => {
    const dummyInputs: AllInputs = {
      repoToken: "",
      configurationPath: "",
      slackWebhookUrl: "dummy_url",
      iconUrl: "",
      botName: ""
    };

    const dummyPayload = {
      requested_reviewer: {
        login: "github_user_1"
      },
      pull_request: {
        title: "pr_title",
        html_url: "pr_url"
      },
      sender: {
        login: "sender_github_username"
      }
    };

    const dummyMapping = {
      github_user_1: "slack_user_1"
    };

    it("should call postToSlack", async () => {
      const githubMock = {
        loadNameMappingConfig: jest.fn(async () => dummyMapping)
      };

      const slackMock = {
        postToSlack: jest.fn()
      };

      await execPrReviewRequestedMention(
        dummyPayload as any,
        dummyInputs,
        githubMock,
        slackMock
      );

      expect(slackMock.postToSlack.mock.calls.length).toEqual(1);

      const call = slackMock.postToSlack.mock.calls[0];
      expect(call[0]).toEqual("dummy_url");
      expect(call[1].includes("<@slack_user_1>")).toEqual(true);
      expect(call[1].includes("<pr_url|pr_title>")).toEqual(true);
      expect(call[1].includes("by sender_github_username")).toEqual(true);
    });
  });
});
