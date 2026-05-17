import type { context } from "@actions/github";

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

const eventCategoryOf = (
  payload: Partial<typeof context.payload>,
): keyof typeof acceptActionTypes | null => {
  if (payload.issue) {
    return payload.comment ? "issue_comment" : "issues";
  }
  if (payload.pull_request) {
    if (payload.review) return "pull_request_review";
    if (payload.comment) return "pull_request_review_comment";
    return "pull_request";
  }
  return null;
};

export const isSupportedEvent = (
  payload: Partial<typeof context.payload>,
): boolean => {
  const category = eventCategoryOf(payload);
  if (category === null) return false;
  if (typeof payload.action !== "string") return false;
  return acceptActionTypes[category].includes(payload.action);
};

export const needToSendReviewSubmittedMention = (
  payload: typeof context.payload,
): boolean => {
  return Boolean(payload.review);
};

export const pickupInfoFromGithubPayload = (
  payload: Partial<typeof context.payload>,
): {
  body: string | null;
  title: string;
  url: string;
  senderName: string;
} => {
  if (payload.issue) {
    if (payload.comment) {
      return {
        body: payload.comment.body,
        title: payload.issue.title,
        url: payload.comment.html_url,
        senderName: payload.sender?.login || "",
      };
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
      return {
        body: payload.review.body,
        title: payload.pull_request?.title || "",
        url: payload.review.html_url,
        senderName: payload.sender?.login || "",
      };
    }

    if (payload.comment) {
      return {
        body: payload.comment.body,
        title: payload.pull_request.title,
        url: payload.comment.html_url,
        senderName: payload.sender?.login || "",
      };
    }

    return {
      body: payload.pull_request.body || "",
      title: payload.pull_request.title,
      url: payload.pull_request.html_url || "",
      senderName: payload.sender?.login || "",
    };
  }

  throw new Error(
    `pickupInfoFromGithubPayload called with unsupported payload. Guard with isSupportedEvent() before calling. payload=${JSON.stringify(payload)}`,
  );
};
