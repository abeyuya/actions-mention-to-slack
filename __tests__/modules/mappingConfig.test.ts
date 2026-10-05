import { getOctokit } from "@actions/github";
import { vi } from "vitest";

import {
  isUrl,
  MappingConfigRepositoryImpl,
} from "../../src/modules/mappingConfig.js";

vi.mock("@actions/github", () => ({
  getOctokit: vi.fn(),
}));

const mockGetContent = (getContent: ReturnType<typeof vi.fn>) => {
  vi.mocked(getOctokit).mockReturnValue({
    rest: { repos: { getContent } },
  } as unknown as ReturnType<typeof getOctokit>);
};

const httpError = (status: number, message: string) =>
  Object.assign(new Error(message), { status });

const contentResponse = (yaml: string) => ({
  data: { content: Buffer.from(yaml).toString("base64") },
});

describe("mappingConfig", () => {
  describe("isUrl", () => {
    it("true https://github.com/abeyuya/actions-mention-to-slack", () => {
      const result = isUrl(
        "https://github.com/abeyuya/actions-mention-to-slack",
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
          "https://example.com",
        );

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect({ github_user_id: "XXXXXXX" }).toEqual(result);
      });
    });

    describe("loadFromGithubPath", () => {
      const load = () =>
        MappingConfigRepositoryImpl.loadFromGithubPath(
          "token",
          "owner",
          "repo",
          ".github/mention-to-slack.yml",
          "abc123",
        );

      beforeEach(() => {
        vi.mocked(getOctokit).mockReset();
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it("should return yaml", async () => {
        const getContent = vi
          .fn()
          .mockResolvedValueOnce(contentResponse('github_user_id: "XXXXXXX"'));
        mockGetContent(getContent);

        const result = await load();

        expect(getContent).toHaveBeenCalledWith({
          owner: "owner",
          repo: "repo",
          path: ".github/mention-to-slack.yml",
          ref: "abc123",
        });
        expect(result).toEqual({ github_user_id: "XXXXXXX" });
      });

      it("should retry on 404 and return yaml once it becomes available", async () => {
        const getContent = vi
          .fn()
          .mockRejectedValueOnce(httpError(404, "Not Found"))
          .mockRejectedValueOnce(httpError(404, "Not Found"))
          .mockResolvedValueOnce(contentResponse('github_user_id: "XXXXXXX"'));
        mockGetContent(getContent);

        const promise = load();
        await vi.advanceTimersByTimeAsync(999);
        expect(getContent).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(getContent).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(2000);

        expect(getContent).toHaveBeenCalledTimes(3);
        expect(await promise).toEqual({ github_user_id: "XXXXXXX" });
      });

      it("should throw with path and ref after exhausting retries on 404", async () => {
        const getContent = vi
          .fn()
          .mockRejectedValue(httpError(404, "Not Found"));
        mockGetContent(getContent);

        const assertion = expect(load()).rejects.toThrow(
          'Failed to fetch configuration file ".github/mention-to-slack.yml" from owner/repo at ref abc123: Not Found',
        );
        await vi.advanceTimersByTimeAsync(1000 + 2000 + 3000);
        await assertion;
        expect(getContent).toHaveBeenCalledTimes(4);
      });

      it("should not retry on non-404 errors", async () => {
        const getContent = vi
          .fn()
          .mockRejectedValue(httpError(403, "Forbidden"));
        mockGetContent(getContent);

        await expect(load()).rejects.toThrow(
          'Failed to fetch configuration file ".github/mention-to-slack.yml" from owner/repo at ref abc123: Forbidden',
        );
        expect(getContent).toHaveBeenCalledTimes(1);
      });
    });
  });
});
