import { getOctokit } from "@actions/github";
import { WebhookPayload } from "@actions/github/lib/interfaces";
import { load } from "js-yaml";
import axios from "axios";

const uniq = <T>(arr: T[]): T[] => [...new Set(arr)];

export const pickupUsername = (text: string): string[] => {
  const pattern = /\B@[a-z0-9_-]+/gi;
  const hits = text.match(pattern);

  if (hits === null) {
    return [];
  }

  return uniq(hits).map((username) => username.replace("@", ""));
};

const acceptActionTypes = {
  issues: ["opened", "edited"],
  issue_comment: ["created", "edited"],
  pull_request: ["opened", "edited", "review_requested"],
  pull_request_review: ["submitted"],
  pull_request_review_comment: ["created", "edited"],
};

const buildError = (payload: unknown): Error => {
  return new Error(
    `unknown event hook: ${JSON.stringify(payload, undefined, 2)}`
  );
};

export const pickupInfoFromGithubPayload = (
  payload: WebhookPayload
): {
  body: string | null;
  title: string;
  url: string;
  senderName: string;
} => {
  const { action } = payload;

  if (action === undefined) {
    throw buildError(payload);
  }

  if (payload.issue) {
    if (payload.comment) {
      if (!acceptActionTypes.issue_comment.includes(action)) {
        throw buildError(payload);
      }

      return {
        body: payload.comment.body,
        title: payload.issue.title,
        url: payload.comment.html_url,
        senderName: payload.sender?.login || "",
      };
    }

    if (!acceptActionTypes.issues.includes(action)) {
      throw buildError(payload);
    }

    return {
      body: payload.issue.body || "",
      title: payload.issue.title,
      url: payload.issue.html_url || "",
      senderName: payload.sender?.login || "",
    };
  }

  if (payload.pull_request) {
    if (payload.review) {
      if (!acceptActionTypes.pull_request_review.includes(action)) {
        throw buildError(payload);
      }

      return {
        body: payload.review.body,
        title: payload.pull_request?.title || "",
        url: payload.review.html_url,
        senderName: payload.sender?.login || "",
      };
    }

    if (payload.comment) {
      if (!acceptActionTypes.issue_comment.includes(action)) {
        throw buildError(payload);
      }

      return {
        body: payload.comment.body,
        title: payload.pull_request.title,
        url: payload.comment.html_url,
        senderName: payload.sender?.login || "",
      };
    }

    if (!acceptActionTypes.pull_request.includes(action)) {
      throw buildError(payload);
    }

    return {
      body: payload.pull_request.body || "",
      title: payload.pull_request.title,
      url: payload.pull_request.html_url || "",
      senderName: payload.sender?.login || "",
    };
  }

  throw buildError(payload);
};

type MappingFile = {
  [githugUsername: string]: string | undefined;
};

export const GithubRepositoryImpl = {
  loadNameMappingConfig: async (
    repoToken: string,
    owner: string,
    repo: string,
    configurationPath: string,
    sha: string
  ): Promise<MappingFile> => {
    const pattern = /https?:\/\/[-_.!~*'()a-zA-Z0-9;/?:@&=+$,%#]+/g;
    if (pattern.test(configurationPath)) {
      const response = await axios.get<string>(configurationPath);
      const configObject = load(response.data);

      if (configObject === undefined) {
        throw new Error(`failed to load yaml\n${configurationPath}`);
      }

      return configObject as MappingFile;
    }

    const githubClient = getOctokit(repoToken);
    const response = await githubClient.rest.repos.getContent({
      owner,
      repo,
      path: configurationPath,
      ref: sha,
    });

    const configurationContent = Buffer.from(
      response.data.toString(),
      "base64"
    ).toString();
    const configObject = load(configurationContent);

    if (configObject === undefined) {
      throw new Error(`failed to load yaml\n${configurationContent}`);
    }

    return configObject as MappingFile;
  },
};
