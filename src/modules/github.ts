import { WebhookPayload } from "@actions/github/lib/interfaces";

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
  discussion: ["created"],
  discussion_comment: ["created"],
};

const buildError = (payload: unknown): Error => {
  return new Error(
    `unknown event hook: ${JSON.stringify(payload, undefined, 2)}`
  );
};

export const needToSendApproveMention = (payload: WebhookPayload): boolean => {
  if (payload.review?.state === "approved") {
    return true;
  }

  return false;
};

export const pickupInfoFromGithubPayload = (
  payload: Partial<WebhookPayload>
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

  if (payload.discussion) {
    if (payload.comment) {
      if (!acceptActionTypes.discussion_comment.includes(action)) {
        throw buildError(payload);
      }

      return {
        body: payload.comment.body,
        title: payload.discussion.title,
        url: payload.comment.html_url,
        senderName: payload.sender?.login || "",
      };
    }

    if (!acceptActionTypes.discussion.includes(action)) {
      throw buildError(payload);
    }

    return {
      body: payload.discussion.body || "",
      title: payload.discussion.title,
      url: payload.discussion.html_url || "",
      senderName: payload.sender?.login || "",
    };
  }

  throw buildError(payload);
};
