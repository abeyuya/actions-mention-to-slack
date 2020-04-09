import {
  pickupUsername,
  pickupInfoFromGithubPayload,
} from "../../src/modules/github";

describe("modules/github", () => {
  describe("pickupUsername", () => {
    it("should return names when message include mention", () => {
      const text =
        "@jpotts18 what is up man? Are you hanging out with @kyle_clegg";
      const result = pickupUsername(text);

      expect(result).toEqual(["jpotts18", "kyle_clegg"]);
    });

    it("should return empty when message not include mention", () => {
      const text = "no mention comment";
      const result = pickupUsername(text);

      expect(result).toEqual([]);
    });
  });

  describe("pickupInfoFromGithubPayload", () => {
    it("should return when issue opend", () => {
      const dummyPayload = {
        action: "opened",
        issue: {
          body: "body",
          title: "title",
          html_url: "url",
        },
        sender: {
          login: "sender_github_username",
        },
      };

      const result = pickupInfoFromGithubPayload(dummyPayload as any);

      expect(result).toEqual({
        body: "body",
        title: "title",
        url: "url",
        senderName: "sender_github_username",
      });
    });

    it("should return when issue commented", () => {
      const dummyPayload = {
        action: "created",
        issue: {
          body: "issue body",
          title: "issue title",
          html_url: "issue url",
        },
        comment: {
          body: "comment body",
          title: "comment title",
          html_url: "comment url",
        },
        sender: {
          login: "sender_github_username",
        },
      };

      const result = pickupInfoFromGithubPayload(dummyPayload as any);

      expect(result).toEqual({
        body: "comment body",
        title: "issue title",
        url: "comment url",
        senderName: "sender_github_username",
      });
    });

    it("should throw error when issue deleted", () => {
      const dummyPayload = {
        action: "deleted",
        issue: {
          body: "body",
          title: "title",
          html_url: "url",
        },
        sender: {
          login: "sender_github_username",
        },
      };

      try {
        pickupInfoFromGithubPayload(dummyPayload as any);
        fail();
      } catch (e) {
        expect(e.message.includes("unknown event hook:")).toEqual(true);
      }
    });

    it("should return when pull_request commented", () => {
      const dummyPayload = {
        action: "created",
        pull_request: {
          body: "pr body",
          title: "pr title",
          html_url: "pr url",
        },
        comment: {
          body: "comment body",
          title: "comment title",
          html_url: "comment url",
        },
        sender: {
          login: "sender_github_username",
        },
      };

      const result = pickupInfoFromGithubPayload(dummyPayload as any);

      expect(result).toEqual({
        body: "comment body",
        title: "pr title",
        url: "comment url",
        senderName: "sender_github_username",
      });
    });
  });
});
