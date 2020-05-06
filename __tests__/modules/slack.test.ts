import {
  buildSlackPostMessage,
  buildSlackErrorMessage,
} from "../../src/modules/slack";

describe("modules/slack", () => {
  describe("buildSlackPostMessage", () => {
    it("should include all info", () => {
      const result = buildSlackPostMessage(
        ["slackUser1"],
        "title",
        "link",
        "message",
        "sender_github_username"
      );

      expect(result.includes("<@slackUser1> has been mentioned")).toEqual(true);
      expect(result.includes("<link|title>")).toEqual(true);
      expect(result.includes("by sender_github_username")).toEqual(true);
      expect(result.includes("> message")).toEqual(true);
    });
  });

  describe("buildSlackErrorMessage", () => {
    it("should include all info", () => {
      const e = new Error("dummy error");
      const result = buildSlackErrorMessage(e);

      expect(result.includes("dummy error")).toEqual(true);
    });
  });
});
