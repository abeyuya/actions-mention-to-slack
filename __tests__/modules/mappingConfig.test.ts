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
      const originalFetch = globalThis.fetch;
      afterEach(() => {
        globalThis.fetch = originalFetch;
      });

      it("should fetch the GitHub contents API and decode base64 content", async () => {
        const yamlText = 'github_user_id: "SLACK_ID"';
        const fetchMock = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              content: Buffer.from(yamlText).toString("base64"),
              encoding: "base64",
            }),
        } as Response);
        globalThis.fetch = fetchMock;

        const result = await MappingConfigRepositoryImpl.loadFromGithubPath(
          "dummy-token",
          "abeyuya",
          "github-actions-test",
          ".github/mention-to-slack.yml",
          "abc123"
        );

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [
          string,
          RequestInit,
        ];
        expect(calledUrl).toBe(
          "https://api.github.com/repos/abeyuya/github-actions-test/contents/.github/mention-to-slack.yml?ref=abc123"
        );
        const headers = calledInit.headers as Record<string, string>;
        expect(headers.Authorization).toBe("Bearer dummy-token");
        expect(result).toEqual({ github_user_id: "SLACK_ID" });
      });

      it("should throw when the response is not ok", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
        } as Response);

        await expect(
          MappingConfigRepositoryImpl.loadFromGithubPath(
            "dummy-token",
            "abeyuya",
            "github-actions-test",
            ".github/mention-to-slack.yml",
            "abc123"
          )
        ).rejects.toThrow(/404 Not Found/);
      });
    });
  });
});
