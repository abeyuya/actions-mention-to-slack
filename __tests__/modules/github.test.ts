import { WebhookPayload } from "@actions/github/lib/interfaces";
import {
  pickupUsername,
  pickupInfoFromGithubPayload,
} from "../../src/modules/github";

import { realPayload } from "../fixture/real-payload-20211017";
import { prApprovePayload } from "../fixture/real-payload-20211024-pr-approve";

describe("modules/github", () => {
  describe("pickupUsername", () => {
    it("should return names if message includes mentions", () => {
      const text =
        "@jpotts18 what is up man? Are you hanging out with @kyle_clegg";
      const result = pickupUsername(text);

      expect(result).toEqual(["jpotts18", "kyle_clegg"]);
    });

    it("should return empty if message does not include mention", () => {
      const text = "no mention comment";
      const result = pickupUsername(text);

      expect(result).toEqual([]);
    });

    it("should return unique names if message includes same mention", () => {
      const text = "hello @abeyuya world @abeyuya";
      const result = pickupUsername(text);

      expect(result).toEqual(["abeyuya"]);
    });

    describe("real payload test 20211017", () => {
      it("should return abeyuya", () => {
        const info = pickupInfoFromGithubPayload(realPayload);
        const result = pickupUsername(info.body || "");
        expect(result).toEqual(["abeyuya"]);
      });
    });
  });

  describe("pickupInfoFromGithubPayload", () => {
    describe("issue event", () => {
      const buildIssuePayload = (action: string): Partial<WebhookPayload> => {
        return {
          action,
          issue: {
            body: "issue body",
            title: "issue title",
            html_url: "issue url",
            number: 1,
          },
          sender: {
            login: "sender_github_username",
            type: "sender_type",
          },
        };
      };

      it("should return when issue opend", () => {
        const dummyPayload = buildIssuePayload("opened");
        const result = pickupInfoFromGithubPayload(dummyPayload);

        expect(result).toEqual({
          body: "issue body",
          title: "issue title",
          url: "issue url",
          senderName: "sender_github_username",
        });
      });

      it("should return when issue edited", () => {
        const dummyPayload = buildIssuePayload("edited");
        const result = pickupInfoFromGithubPayload(dummyPayload);

        expect(result).toEqual({
          body: "issue body",
          title: "issue title",
          url: "issue url",
          senderName: "sender_github_username",
        });
      });

      it("should throw error when issue deleted", () => {
        const dummyPayload = buildIssuePayload("deleted");

        try {
          pickupInfoFromGithubPayload(dummyPayload);
          fail();
        } catch (e: unknown) {
          expect((e as Error).message.includes("unknown event hook:")).toEqual(
            true
          );
        }
      });
    });

    describe("issue comment event", () => {
      const buildIssueCommentPayload = (
        action: string
      ): Partial<WebhookPayload> => {
        return {
          action,
          issue: {
            body: "issue body",
            title: "issue title",
            html_url: "issue url",
            number: 1,
          },
          comment: {
            id: 1,
            body: "comment body",
            title: "comment title",
            html_url: "comment url",
          },
          sender: {
            login: "sender_github_username",
            type: "sender_type",
          },
        };
      };

      it("should return when issue commented", () => {
        const dummyPayload = buildIssueCommentPayload("created");
        const result = pickupInfoFromGithubPayload(dummyPayload);

        expect(result).toEqual({
          body: "comment body",
          title: "issue title",
          url: "comment url",
          senderName: "sender_github_username",
        });
      });

      it("should return when issue commented with blockquotes", () => {
        const dummyPayload: Partial<WebhookPayload> = {
          action: "created",
          issue: {
            body: "issue body",
            title: "issue title",
            html_url: "issue url",
            number: 1,
          },
          comment: {
            id: 1,
            body: "> comment body \nhello",
            title: "comment title",
            html_url: "comment url",
          },
          sender: {
            login: "sender_github_username",
            type: "sender_type",
          },
        };
        const result = pickupInfoFromGithubPayload(dummyPayload);

        expect(result).toEqual({
          body: "> comment body \nhello",
          title: "issue title",
          url: "comment url",
          senderName: "sender_github_username",
        });
      });

      it("should return when issue comment edited", () => {
        const dummyPayload = buildIssueCommentPayload("edited");
        const result = pickupInfoFromGithubPayload(dummyPayload);

        expect(result).toEqual({
          body: "comment body",
          title: "issue title",
          url: "comment url",
          senderName: "sender_github_username",
        });
      });

      it("should throw error when issue comment deleted", () => {
        const dummyPayload = buildIssueCommentPayload("deleted");

        try {
          pickupInfoFromGithubPayload(dummyPayload);
          fail();
        } catch (e: unknown) {
          expect((e as Error).message.includes("unknown event hook:")).toEqual(
            true
          );
        }
      });
    });

    describe("pr event", () => {
      const buildPrPayload = (action: string): Partial<WebhookPayload> => {
        return {
          action,
          pull_request: {
            body: "pr body",
            title: "pr title",
            html_url: "pr url",
            number: 1,
          },
          sender: {
            login: "sender_github_username",
            type: "sender_type",
          },
        };
      };

      it("should return when pr opend", () => {
        const dummyPayload = buildPrPayload("opened");
        const result = pickupInfoFromGithubPayload(dummyPayload);

        expect(result).toEqual({
          body: "pr body",
          title: "pr title",
          url: "pr url",
          senderName: "sender_github_username",
        });
      });

      it("should return when pr edited", () => {
        const dummyPayload = buildPrPayload("edited");
        const result = pickupInfoFromGithubPayload(dummyPayload);

        expect(result).toEqual({
          body: "pr body",
          title: "pr title",
          url: "pr url",
          senderName: "sender_github_username",
        });
      });

      it("should throw error when pr deleted", () => {
        const dummyPayload = buildPrPayload("deleted");

        try {
          pickupInfoFromGithubPayload(dummyPayload);
          fail();
        } catch (e: unknown) {
          expect((e as Error).message.includes("unknown event hook:")).toEqual(
            true
          );
        }
      });
    });

    describe("pr comment event", () => {
      const buildPrCommentPayload = (
        action: string
      ): Partial<WebhookPayload> => {
        return {
          action,
          pull_request: {
            body: "pr body",
            title: "pr title",
            html_url: "pr url",
            number: 1,
          },
          comment: {
            id: 1,
            body: "comment body",
            title: "comment title",
            html_url: "comment url",
          },
          sender: {
            login: "sender_github_username",
            type: "sender_type",
          },
        };
      };

      it("should return when pull_request commented", () => {
        const dummyPayload = buildPrCommentPayload("created");
        const result = pickupInfoFromGithubPayload(dummyPayload);

        expect(result).toEqual({
          body: "comment body",
          title: "pr title",
          url: "comment url",
          senderName: "sender_github_username",
        });
      });

      it("should return when pull_request comment edited", () => {
        const dummyPayload = buildPrCommentPayload("edited");
        const result = pickupInfoFromGithubPayload(dummyPayload);

        expect(result).toEqual({
          body: "comment body",
          title: "pr title",
          url: "comment url",
          senderName: "sender_github_username",
        });
      });

      it("should throw error when pull_request comment deleted", () => {
        const dummyPayload = buildPrCommentPayload("deleted");

        try {
          pickupInfoFromGithubPayload(dummyPayload);
          fail();
        } catch (e: unknown) {
          expect((e as Error).message.includes("unknown event hook:")).toEqual(
            true
          );
        }
      });
    });

    describe("pr review event", () => {
      const buildPrReviewPayload = (
        action: string
      ): Partial<WebhookPayload> => {
        return {
          action,
          pull_request: {
            body: "pr body",
            title: "pr title",
            html_url: "pr url",
            number: 1,
          },
          review: {
            body: "review body",
            title: "review title",
            html_url: "review url",
          },
          sender: {
            login: "sender_github_username",
            type: "sender_type",
          },
        };
      };

      it("should return when review submitted", () => {
        const dummyPayload = buildPrReviewPayload("submitted");
        const result = pickupInfoFromGithubPayload(dummyPayload);

        expect(result).toEqual({
          body: "review body",
          title: "pr title",
          url: "review url",
          senderName: "sender_github_username",
        });
      });
    });

    describe("real payloat test 20211017", () => {
      it("should return correct info", () => {
        const result = pickupInfoFromGithubPayload(realPayload);
        expect(result.title).toEqual("test");
        expect(result.senderName).toEqual("abeyuya");
      });
    });

    describe("real payloat test 20211024 pr approve", () => {
      it("should return correct info", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = pickupInfoFromGithubPayload(prApprovePayload as any);
        expect(result.title).toEqual("Update mention-to-slack.yml");
        expect(result.senderName).toEqual("abeyuya");
        expect(result.body).toEqual("approve comment");
      });
    });
  });
});
