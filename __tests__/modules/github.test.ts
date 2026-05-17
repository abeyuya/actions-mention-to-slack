import type { context } from "@actions/github";
import {
  isSupportedEvent,
  pickupInfoFromGithubPayload,
  pickupUsername,
} from "../../src/modules/github.js";

import { realPayload } from "../fixture/real-payload-20211017.js";
import { prApprovePayload } from "../fixture/real-payload-20211024-pr-approve.js";

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
      const buildIssuePayload = (
        action: string,
      ): Partial<typeof context.payload> => {
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

      describe("isSupportedEvent", () => {
        it.each(["opened", "edited"])("returns true for %s", (action) => {
          expect(isSupportedEvent(buildIssuePayload(action))).toBe(true);
        });

        it.each([
          "deleted",
          "closed",
          "reopened",
        ])("returns false for %s", (action) => {
          expect(isSupportedEvent(buildIssuePayload(action))).toBe(false);
        });
      });
    });

    describe("issue comment event", () => {
      const buildIssueCommentPayload = (
        action: string,
      ): Partial<typeof context.payload> => {
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
        const dummyPayload: Partial<typeof context.payload> = {
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

      describe("isSupportedEvent", () => {
        it.each(["created", "edited"])("returns true for %s", (action) => {
          expect(isSupportedEvent(buildIssueCommentPayload(action))).toBe(true);
        });

        it.each(["deleted"])("returns false for %s", (action) => {
          expect(isSupportedEvent(buildIssueCommentPayload(action))).toBe(
            false,
          );
        });
      });
    });

    describe("pr event", () => {
      const buildPrPayload = (
        action: string,
      ): Partial<typeof context.payload> => {
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

      describe("isSupportedEvent", () => {
        it.each([
          "opened",
          "edited",
          "review_requested",
        ])("returns true for %s", (action) => {
          expect(isSupportedEvent(buildPrPayload(action))).toBe(true);
        });

        it.each([
          "closed",
          "reopened",
          "ready_for_review",
          "synchronize",
          "labeled",
          "unlabeled",
          "assigned",
          "unassigned",
        ])("returns false for %s", (action) => {
          expect(isSupportedEvent(buildPrPayload(action))).toBe(false);
        });
      });
    });

    describe("pr comment event", () => {
      const buildPrCommentPayload = (
        action: string,
      ): Partial<typeof context.payload> => {
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

      describe("isSupportedEvent", () => {
        it.each(["created", "edited"])("returns true for %s", (action) => {
          expect(isSupportedEvent(buildPrCommentPayload(action))).toBe(true);
        });

        it.each(["deleted"])("returns false for %s", (action) => {
          expect(isSupportedEvent(buildPrCommentPayload(action))).toBe(false);
        });
      });
    });

    describe("pr review event", () => {
      const buildPrReviewPayload = (
        action: string,
      ): Partial<typeof context.payload> => {
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

      describe("isSupportedEvent", () => {
        it.each(["submitted"])("returns true for %s", (action) => {
          expect(isSupportedEvent(buildPrReviewPayload(action))).toBe(true);
        });

        it.each(["edited", "dismissed"])("returns false for %s", (action) => {
          expect(isSupportedEvent(buildPrReviewPayload(action))).toBe(false);
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
        const result = pickupInfoFromGithubPayload(prApprovePayload as any);
        expect(result.title).toEqual("Update mention-to-slack.yml");
        expect(result.senderName).toEqual("abeyuya");
        expect(result.body).toEqual("approve comment");
      });
    });
  });

  describe("isSupportedEvent edge cases", () => {
    it("returns false when action is missing", () => {
      expect(isSupportedEvent({})).toBe(false);
    });

    it("returns false when neither issue nor pull_request is present", () => {
      expect(isSupportedEvent({ action: "opened" })).toBe(false);
    });
  });
});
