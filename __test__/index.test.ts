import { pickupUsername } from "../src/index";

describe("src/index", () => {
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
});
