import {
  pickupUsername,
  pickupInfoFromGithubPayload
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
          html_url: "url"
        }
      };

      const result = pickupInfoFromGithubPayload(dummyPayload as any);

      expect(result).toEqual({
        body: "body",
        title: "title",
        url: "url"
      });
    });
  });
});
