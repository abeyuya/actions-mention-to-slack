import { WebhookPayload } from "@actions/github/lib/interfaces";

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
} => {
  if (payload.action === "opened" && payload.issue) {
    return {
      body: payload.issue.body || "",
      title: payload.issue.title,
      url: payload.issue.html_url || ""
    };
  }

  if (payload.action === "opened" && payload.pull_request) {
    return {
      body: payload.pull_request.body || "",
      title: payload.pull_request.title,
      url: payload.pull_request.html_url || ""
    };
  }

  if (payload.action === "created" && payload.comment) {
    if (payload.issue) {
      return {
        body: payload.comment.body,
        title: payload.issue.title,
        url: payload.comment.html_url
      };
    }

    if (payload.pull_request) {
      return {
        body: payload.comment.body,
        title: payload.pull_request.title,
        url: payload.comment.html_url
      };
    }
  }

  if (payload.action === "submitted" && payload.review) {
    return {
      body: payload.review.body,
      title: payload.pull_request?.title || "",
      url: payload.review.html_url
    };
  }

  throw new Error(
    `unknown event hook: ${JSON.stringify(payload, undefined, 2)}`
  );
};
