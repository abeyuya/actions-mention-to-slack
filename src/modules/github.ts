import * as github from "@actions/github";
import { WebhookPayload } from "@actions/github/lib/interfaces";
import * as yaml from "js-yaml";

export const pickupUsername = (text: string) => {
  const pattern = /\B@[a-z0-9_-]+/gi;
  const hits = text.match(pattern);

  if (hits === null) {
    return [];
  }

  return hits.map((username) => username.replace("@", ""));
};

const acceptActionTypes = {
  issues: ["opened", "edited"],
  issue_comment: ["created", "edited"],
  pull_request: ["opened", "edited", "review_requested"],
  pull_request_review: ["submitted"],
  pull_request_review_comment: ["created", "edited"],
};

const buildError = (payload: object): Error => {
  return new Error(
    `unknown event hook: ${JSON.stringify(payload, undefined, 2)}`
  );
};

export const pickupInfoFromGithubPayload = (
  payload: WebhookPayload
): {
  body: string;
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

  if (payload.pull_request && acceptActionTypes.pull_request.includes(action)) {
    return {
      body: payload.pull_request.body || "",
      title: payload.pull_request.title,
      url: payload.pull_request.html_url || "",
      senderName: payload.sender?.login || "",
    };
  }

  if (payload.action === "created" && payload.comment) {
    if (payload.pull_request) {
      return {
        body: payload.comment.body,
        title: payload.pull_request.title,
        url: payload.comment.html_url,
        senderName: payload.sender?.login || "",
      };
    }
  }

  if (payload.action === "submitted" && payload.review) {
    return {
      body: payload.review.body,
      title: payload.pull_request?.title || "",
      url: payload.review.html_url,
      senderName: payload.sender?.login || "",
    };
  }

  throw buildError(payload);
};

const fetchContent = async (
  client: github.GitHub,
  repoPath: string
): Promise<string> => {
  const response: any = await client.repos.getContents({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    path: repoPath,
    ref: github.context.sha,
  });

  return Buffer.from(response.data.content, response.data.encoding).toString();
};

type MappingFile = {
  [githugUsername: string]: string | undefined;
};

export const GithubRepositoryImpl = {
  loadNameMappingConfig: async (
    repoToken: string,
    configurationPath: string
  ) => {
    const githubClient = new github.GitHub(repoToken);
    const configurationContent = await fetchContent(
      githubClient,
      configurationPath
    );

    const configObject: MappingFile = yaml.safeLoad(configurationContent);
    return configObject;
  },
};
