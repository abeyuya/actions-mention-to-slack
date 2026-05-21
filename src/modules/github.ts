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

export type GithubPayloadInfo = {
  body: string | null;
  title: string;
  url: string;
  senderName: string;
  repoShortName: string;
  number: number;
};

export const pickupInfoFromGithubPayload = (
  payload: Partial<typeof context.payload>,
): GithubPayloadInfo => {
  const repoShortName = payload.repository?.name || "";
  const senderName = payload.sender?.login || "";
  const make = (
    body: string | null,
    title: string,
    url: string,
    number: number,
  ): GithubPayloadInfo => ({
    body,
    title,
    url,
    senderName,
    repoShortName,
    number,
  });

  if (payload.issue) {
    const number = payload.issue.number || 0;
    if (payload.comment) {
      return make(
        payload.comment.body,
        payload.issue.title,
        payload.comment.html_url,
        number,
      );
    }
    return make(
      payload.issue.body || "",
      payload.issue.title,
      payload.issue.html_url || "",
      number,
    );
  }

  if (payload.pull_request) {
    const number = payload.pull_request.number || 0;
    if (payload.review) {
      return make(
        payload.review.body,
        payload.pull_request.title || "",
        payload.review.html_url,
        number,
      );
    }
    if (payload.comment) {
      return make(
        payload.comment.body,
        payload.pull_request.title,
        payload.comment.html_url,
        number,
      );
    }
    return make(
      payload.pull_request.body || "",
      payload.pull_request.title,
      payload.pull_request.html_url || "",
      number,
    );
  }

  throw new Error(
    `pickupInfoFromGithubPayload called with unsupported payload. Guard with isSupportedEvent() before calling. payload=${JSON.stringify(payload)}`,
  );
};
