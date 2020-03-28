import { buildSlackPostMessage } from "../../src/modules/slack";

describe("modules/slack", () => {
  describe("buildSlackPostMessage", () => {
    it("should include all info", () => {
      const result = buildSlackPostMessage(
        ["slackUser1"],
        "title",
        "link",
        "message"
      );

      expect(result.includes("<@slackUser1>")).toEqual(true);
      expect(result.includes("<link|title>")).toEqual(true);
      expect(result.includes("> message")).toEqual(true);
    });
  });
});
