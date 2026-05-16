import { getOctokit } from "@actions/github";
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
    const response = await githubClient.rest.repos.getContent({
      owner,
      repo,
      path: configurationPath,
      ref: sha,
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
