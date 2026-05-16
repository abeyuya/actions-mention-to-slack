import { vi } from "vitest";

import {
  isUrl,
  MappingConfigRepositoryImpl,
} from "../../src/modules/mappingConfig.js";

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

  describe("MappingConfigRepositoryImpl", () => {
    describe("loadFromUrl", () => {
      const originalFetch = globalThis.fetch;
      afterEach(() => {
        globalThis.fetch = originalFetch;
      });

      it("should return yaml", async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('github_user_id: "XXXXXXX"'),
        } as Response);
        globalThis.fetch = fetchMock;

        const result = await MappingConfigRepositoryImpl.loadFromUrl(
          "https://example.com"
        );

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect({ github_user_id: "XXXXXXX" }).toEqual(result);
      });
    });

    describe("loadFromGithubPath", () => {
      it.todo("real test (requires GITHUB_TOKEN)");
    });
  });
});
