import * as github from "@actions/github";
import { WebhookPayload } from "@actions/github/lib/interfaces";
import * as yaml from "js-yaml";

export const pickupUsername = (text: string) => {
  const pattern = /\B@[a-z0-9_-]+/gi;
  const hits = text.match(pattern);

  if (hits === null) {
    return [];
  }

  return hits.map(username => username.replace("@", ""));
};

export const pickupInfoFromGithubPayload = (
  payload: WebhookPayload
): {
  body: string;
  title: string;
  url: string;
  senderName: string;
} => {
  if (payload.action === "opened" && payload.issue) {
    return {
      body: payload.issue.body || "",
      title: payload.issue.title,
      url: payload.issue.html_url || "",
      senderName: payload.sender?.login || ""
    };
  }

  if (payload.action === "opened" && payload.pull_request) {
    return {
      body: payload.pull_request.body || "",
      title: payload.pull_request.title,
      url: payload.pull_request.html_url || "",
      senderName: payload.sender?.login || ""
    };
  }

  if (payload.action === "created" && payload.comment) {
    if (payload.issue) {
      return {
        body: payload.comment.body,
        title: payload.issue.title,
        url: payload.comment.html_url,
        senderName: payload.sender?.login || ""
      };
    }

    if (payload.pull_request) {
      return {
        body: payload.comment.body,
        title: payload.pull_request.title,
        url: payload.comment.html_url,
        senderName: payload.sender?.login || ""
      };
    }
  }

  if (payload.action === "submitted" && payload.review) {
    return {
      body: payload.review.body,
      title: payload.pull_request?.title || "",
      url: payload.review.html_url,
      senderName: payload.sender?.login || ""
    };
  }

  throw new Error(
    `unknown event hook: ${JSON.stringify(payload, undefined, 2)}`
  );
};

const fetchContent = async (
  client: github.GitHub,
  repoPath: string
): Promise<string> => {
  const response: any = await client.repos.getContents({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    path: repoPath,
    ref: github.context.sha
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
  }
};
