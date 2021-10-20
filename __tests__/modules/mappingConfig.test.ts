import { isUrl } from "../../src/modules/mappingConfig";

describe("mappingConfig", () => {
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
