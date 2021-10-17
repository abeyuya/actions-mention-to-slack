import axios from "axios";

import {
  pickupUsername,
  pickupInfoFromGithubPayload,
  GithubRepositoryImpl,
} from "../../src/modules/github";

import { realPayload } from "./real-payload-20211017";

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
  });

  describe("pickupInfoFromGithubPayload", () => {
    describe("issue event", () => {
      const buildIssuePayload = (action: string) => {
        return {
          action,
          issue: {
            body: "issue body",
            title: "issue title",
            html_url: "issue url",
          },
          sender: {
            login: "sender_github_username",
          },
        };
      };

      it("should return when issue opend", () => {
        const dummyPayload = buildIssuePayload("opened");
        const result = pickupInfoFromGithubPayload(dummyPayload as any);

        expect(result).toEqual({
          body: "issue body",
          title: "issue title",
          url: "issue url",
          senderName: "sender_github_username",
        });
      });

      it("should return when issue edited", () => {
        const dummyPayload = buildIssuePayload("edited");
        const result = pickupInfoFromGithubPayload(dummyPayload as any);

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
          pickupInfoFromGithubPayload(dummyPayload as any);
          fail();
        } catch (e: any) {
          expect(e.message.includes("unknown event hook:")).toEqual(true);
        }
      });
    });

    describe("issue comment event", () => {
      const buildIssueCommentPayload = (action: string) => {
        return {
          action,
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
      };

      it("should return when issue commented", () => {
        const dummyPayload = buildIssueCommentPayload("created");
        const result = pickupInfoFromGithubPayload(dummyPayload as any);

        expect(result).toEqual({
          body: "comment body",
          title: "issue title",
          url: "comment url",
          senderName: "sender_github_username",
        });
      });

      it("should return when issue commented with blockquotes", () => {
        const dummyPayload = {
          action: "created",
          issue: {
            body: "issue body",
            title: "issue title",
            html_url: "issue url",
          },
          comment: {
            body: "> comment body \nhello",
            title: "comment title",
            html_url: "comment url",
          },
          sender: {
            login: "sender_github_username",
          },
        };
        const result = pickupInfoFromGithubPayload(dummyPayload as any);

        expect(result).toEqual({
          body: "> comment body \nhello",
          title: "issue title",
          url: "comment url",
          senderName: "sender_github_username",
        });
      });

      it("should return when issue comment edited", () => {
        const dummyPayload = buildIssueCommentPayload("edited");
        const result = pickupInfoFromGithubPayload(dummyPayload as any);

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
          pickupInfoFromGithubPayload(dummyPayload as any);
          fail();
        } catch (e: any) {
          expect(e.message.includes("unknown event hook:")).toEqual(true);
        }
      });
    });

    describe("pr event", () => {
      const buildPrPayload = (action: string) => {
        return {
          action,
          pull_request: {
            body: "pr body",
            title: "pr title",
            html_url: "pr url",
          },
          sender: {
            login: "sender_github_username",
          },
        };
      };

      it("should return when pr opend", () => {
        const dummyPayload = buildPrPayload("opened");
        const result = pickupInfoFromGithubPayload(dummyPayload as any);

        expect(result).toEqual({
          body: "pr body",
          title: "pr title",
          url: "pr url",
          senderName: "sender_github_username",
        });
      });

      it("should return when pr edited", () => {
        const dummyPayload = buildPrPayload("edited");
        const result = pickupInfoFromGithubPayload(dummyPayload as any);

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
          pickupInfoFromGithubPayload(dummyPayload as any);
          fail();
        } catch (e: any) {
          expect(e.message.includes("unknown event hook:")).toEqual(true);
        }
      });
    });

    describe("pr comment event", () => {
      const buildPrCommentPayload = (action: string) => {
        return {
          action,
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
      };

      it("should return when pull_request commented", () => {
        const dummyPayload = buildPrCommentPayload("created");
        const result = pickupInfoFromGithubPayload(dummyPayload as any);

        expect(result).toEqual({
          body: "comment body",
          title: "pr title",
          url: "comment url",
          senderName: "sender_github_username",
        });
      });

      it("should return when pull_request comment edited", () => {
        const dummyPayload = buildPrCommentPayload("edited");
        const result = pickupInfoFromGithubPayload(dummyPayload as any);

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
          pickupInfoFromGithubPayload(dummyPayload as any);
          fail();
        } catch (e: any) {
          expect(e.message.includes("unknown event hook:")).toEqual(true);
        }
      });
    });

    describe("pr review event", () => {
      const buildPrReviewPayload = (action: string) => {
        return {
          action,
          pull_request: {
            body: "pr body",
            title: "pr title",
            html_url: "pr url",
          },
          review: {
            body: "review body",
            title: "review title",
            html_url: "review url",
          },
          sender: {
            login: "sender_github_username",
          },
        };
      };

      it("should return when review submitted", () => {
        const dummyPayload = buildPrReviewPayload("submitted");
        const result = pickupInfoFromGithubPayload(dummyPayload as any);

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
  });

  describe("GithubRepositoryImpl", () => {
    describe("loadNameMappingConfig", () => {
      // it("real test", async () => {
      //   const result = await GithubRepositoryImpl.loadNameMappingConfig(
      //     process.env.GITHUB_TOKEN || "",
      //     "abeyuya",
      //     "github-actions-test",
      //     ".github/mention-to-slack.yml",
      //     "783a58d010c23f10e80f0177e406cde78d1ea894"
      //   );

      //   console.log(result);
      // });

      describe("setting config url", () => {
        it("should return yaml", async () => {
          const spy = jest
            .spyOn(axios, "get")
            .mockResolvedValueOnce({ data: 'github_user_id: "XXXXXXX"' });

          const result = await GithubRepositoryImpl.loadNameMappingConfig(
            process.env.GITHUB_TOKEN || "",
            "abeyuya",
            "github-actions-test",
            "https://example.com",
            "783a58d010c23f10e80f0177e406cde78d1ea894"
          );

          expect(spy).toHaveBeenCalledTimes(1);
          expect({ github_user_id: "XXXXXXX" }).toEqual(result);
        });
      });
    });
  });
});
