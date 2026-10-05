import { getOctokit } from "@actions/github";
import { load } from "js-yaml";

const pattern = /https?:\/\/[-_.!~*'()a-zA-Z0-9;/?:@&=+$,%#]+/g;
export const isUrl = (text: string) => pattern.test(text);

const NOT_FOUND_RETRY_DELAYS_MS = [1000, 2000, 3000];

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const isNotFoundError = (e: unknown) =>
  typeof e === "object" && e !== null && "status" in e && e.status === 404;

export type MappingFile = {
  [githugUsername: string]: string | undefined;
};

export const MappingConfigRepositoryImpl = {
  downloadFromUrl: async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to download mapping config: ${response.status} ${response.statusText}`,
      );
    }
    return response.text();
  },

  loadYaml: (data: string) => {
    const configObject = load(data);

    if (configObject === undefined) {
      throw new Error(
        ["failed to load yaml", JSON.stringify({ data }, null, 2)].join("\n"),
      );
    }

    return configObject as MappingFile;
  },

  loadFromUrl: async (url: string) => {
    const data = await MappingConfigRepositoryImpl.downloadFromUrl(url);
    return MappingConfigRepositoryImpl.loadYaml(data);
  },

  loadFromGithubPath: async (
    repoToken: string,
    owner: string,
    repo: string,
    configurationPath: string,
    sha: string,
  ) => {
    const githubClient = getOctokit(repoToken);
    const getContent = async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await githubClient.rest.repos.getContent({
            owner,
            repo,
            path: configurationPath,
            ref: sha,
          });
        } catch (e) {
          // Right after the PR head moves, the freshly recreated
          // refs/pull/N/merge commit may not be readable yet and the API
          // briefly returns 404. Retry a few times before giving up.
          const delay = NOT_FOUND_RETRY_DELAYS_MS[attempt];
          if (!isNotFoundError(e) || delay === undefined) {
            throw e;
          }
          await sleep(delay);
        }
      }
    };

    const response = await getContent().catch((e: unknown) => {
      const reason = e instanceof Error ? e.message : String(e);
      throw Object.assign(
        new Error(
          `Failed to fetch configuration file "${configurationPath}" from ${owner}/${repo} at ref ${sha}: ${reason}`,
        ),
        { cause: e },
      );
    });

    if (!("content" in response.data)) {
      throw new Error(
        ["Unexpected response", JSON.stringify({ response }, null, 2)].join(
          "\n",
        ),
      );
    }

    const data = Buffer.from(response.data.content, "base64").toString();

    return MappingConfigRepositoryImpl.loadYaml(data);
  },
};
