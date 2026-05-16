import { load } from "js-yaml";

const pattern = /https?:\/\/[-_.!~*'()a-zA-Z0-9;/?:@&=+$,%#]+/g;
export const isUrl = (text: string) => pattern.test(text);

export type MappingFile = {
  [githugUsername: string]: string | undefined;
};

export const MappingConfigRepositoryImpl = {
  downloadFromUrl: async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to download mapping config: ${response.status} ${response.statusText}`
      );
    }
    return response.text();
  },

  loadYaml: (data: string) => {
    const configObject = load(data);

    if (configObject === undefined) {
      throw new Error(
        ["failed to load yaml", JSON.stringify({ data }, null, 2)].join("\n")
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
    sha: string
  ) => {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${configurationPath}?ref=${encodeURIComponent(sha)}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${repoToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "actions-mention-to-slack",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch mapping config from GitHub: ${response.status} ${response.statusText}`
      );
    }

    const body = (await response.json()) as {
      content?: string;
      encoding?: string;
    };

    if (typeof body.content !== "string") {
      throw new Error(
        ["Unexpected response", JSON.stringify({ body }, null, 2)].join("\n")
      );
    }

    const data = Buffer.from(body.content, "base64").toString();

    return MappingConfigRepositoryImpl.loadYaml(data);
  },
};
