import axios from "axios";

import {
  isUrl,
  MappingConfigRepositoryImpl,
} from "../../src/modules/mappingConfig";

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

  describe("loadFromUrl", () => {
    it("should return yaml", async () => {
      const spy = jest
        .spyOn(axios, "get")
        .mockResolvedValueOnce({ data: 'github_user_id: "XXXXXXX"' });

      const result = await MappingConfigRepositoryImpl.loadFromUrl(
        "https://example.com"
      );

      expect(spy).toHaveBeenCalledTimes(1);
      expect({ github_user_id: "XXXXXXX" }).toEqual(result);
    });
  });
});
