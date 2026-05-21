import { slackifyMarkdown } from "slackify-markdown";

export type SlackPostPayload = {
  text: string;
  blocks: unknown[];
  attachments: unknown[];
};

// Slack section block text.text の上限は 3000 文字。安全余白を取って分割閾値を決める。
export const SECTION_TEXT_LIMIT = 2800;
export const CONTINUATION_SUFFIX = " (cont.)";
export const QUOTE_ATTACHMENT_COLOR = "#35373b";

export const splitMrkdwnByLimit = (
  text: string,
  limit: number = SECTION_TEXT_LIMIT,
): string[] => {
  if (text.length === 0) return [];
  if (text.length <= limit) return [text];

  const chunks: string[] = [];
  const lines = text.split("\n");
  let current = "";

  const flushCurrent = () => {
    if (current.length > 0) {
      chunks.push(current);
      current = "";
    }
  };

  const pushLongLine = (line: string) => {
    const room = limit - CONTINUATION_SUFFIX.length;
    let remaining = line;
    while (remaining.length > 0) {
      if (remaining.length <= limit) {
        chunks.push(remaining);
        remaining = "";
      } else {
        chunks.push(`${remaining.slice(0, room)}${CONTINUATION_SUFFIX}`);
        remaining = remaining.slice(room);
      }
    }
  };

  for (const line of lines) {
    if (line.length > limit) {
      flushCurrent();
      pushLongLine(line);
      continue;
    }

    const candidate = current.length === 0 ? line : `${current}\n${line}`;
    if (candidate.length > limit) {
      flushCurrent();
      current = line;
    } else {
      current = candidate;
    }
  }
  flushCurrent();

  return chunks;
};

export const buildSection = (text: string) => ({
  type: "section",
  text: { type: "mrkdwn", text },
});

const buildQuoteAttachments = (chunks: string[]): unknown[] => {
  if (chunks.length === 0) return [];
  return [
    {
      color: QUOTE_ATTACHMENT_COLOR,
      blocks: chunks.map((chunk) => buildSection(chunk)),
    },
  ];
};

// slackify-markdown は末尾に改行を足してくるので trimEnd で揃える。
// 戻り値には強調記号 (*foo*, ~foo~) の隣接対策で ZWSP (U+200B) が含まれることがあるが、
// Slack 上で強調を確実に機能させるための仕様 (隣接文字との連結を防ぐ) なので除去しない。
export const convertGithubMarkdownToSlackMrkdwn = (
  body: string | null | undefined,
): string => (body ? slackifyMarkdown(body).trimEnd() : "");

// 純正 GitHub Slack 連携の表記に揃える: `[<repo>#<number>] <title>`
export const formatIssueRef = (
  repoShortName: string,
  number: number,
  title: string,
): string => `[${repoShortName}#${number}] ${title}`;

export const formatIssueRefLink = (
  url: string,
  repoShortName: string,
  number: number,
  title: string,
): string => `<${url}|${formatIssueRef(repoShortName, number, title)}>`;

const buildHeaderWithQuotedBody = (
  headline: string,
  body: string | null | undefined,
): SlackPostPayload => {
  const converted = convertGithubMarkdownToSlackMrkdwn(body);
  return {
    text: headline,
    blocks: [buildSection(headline)],
    attachments: buildQuoteAttachments(splitMrkdwnByLimit(converted)),
  };
};

export const buildSlackPostMessage = (
  slackIdsForMention: string[],
  repoShortName: string,
  issueNumber: number,
  issueTitle: string,
  commentLink: string,
  githubBody: string,
  senderName: string,
): SlackPostPayload => {
  const mentionBlock = slackIdsForMention.map((id) => `<@${id}>`).join(" ");
  const refLink = formatIssueRefLink(
    commentLink,
    repoShortName,
    issueNumber,
    issueTitle,
  );
  const headline = `${mentionBlock} ${senderName} mentioned you in ${refLink}`;
  return buildHeaderWithQuotedBody(headline, githubBody);
};

export const buildSlackReviewRequestedMessage = (
  reviewerSlackMention: string,
  url: string,
  repoShortName: string,
  prNumber: number,
  prTitle: string,
  requester: string,
): SlackPostPayload => {
  const refLink = formatIssueRefLink(url, repoShortName, prNumber, prTitle);
  const headline = `${reviewerSlackMention} ${requester} requested your review on ${refLink}`;
  return {
    text: headline,
    blocks: [buildSection(headline)],
    attachments: [],
  };
};

export const buildSlackReviewSubmittedMessage = (
  prOwnerSlackUserId: string,
  url: string,
  repoShortName: string,
  prNumber: number,
  prTitle: string,
  reviewer: string,
  reviewState: string | undefined,
  reviewBody: string | null | undefined,
): SlackPostPayload => {
  const userMention = `<@${prOwnerSlackUserId}>`;
  const refLink = formatIssueRefLink(url, repoShortName, prNumber, prTitle);
  const headline = (() => {
    switch (reviewState) {
      case "approved":
        return `${userMention} ${reviewer} approved ${refLink}`;
      case "changes_requested":
        return `${userMention} ${reviewer} requested changes on ${refLink}`;
      default:
        return `${userMention} ${reviewer} commented on ${refLink}`;
    }
  })();
  return buildHeaderWithQuotedBody(headline, reviewBody);
};

export const buildSlackCommentToAuthorMessage = (
  prAuthorSlackUserId: string,
  url: string,
  repoShortName: string,
  prNumber: number,
  prTitle: string,
  commenter: string,
  commentBody: string | null | undefined,
): SlackPostPayload => {
  const refLink = formatIssueRefLink(url, repoShortName, prNumber, prTitle);
  const headline = `<@${prAuthorSlackUserId}> ${commenter} commented on ${refLink}`;
  return buildHeaderWithQuotedBody(headline, commentBody);
};

const openIssueLink =
  "https://github.com/abeyuya/actions-mention-to-slack/issues/new";

export const buildSlackErrorMessage = (
  error: Error,
  currentJobUrl?: string,
): SlackPostPayload => {
  const jobTitle = "mention-to-slack action";
  const jobLinkMessage = currentJobUrl
    ? `<${currentJobUrl}|${jobTitle}>`
    : jobTitle;

  const issueBody = error.stack
    ? encodeURI(["```", error.stack, "```"].join("\n"))
    : "";

  const link = encodeURI(
    `${openIssueLink}?title=${error.message}&body=${issueBody}`,
  );

  const headline = [
    `❗ An internal error occurred in ${jobLinkMessage}`,
    "(but action didn't fail as this action is not critical).",
    `To solve the problem, please <${link}|open an issue>`,
  ].join("\n");

  const stack = error.stack || error.message;
  const stackChunks = splitMrkdwnByLimit(stack).map((chunk) =>
    ["```", chunk, "```"].join("\n"),
  );

  return {
    text: `❗ An internal error occurred in ${jobTitle}`,
    blocks: [buildSection(headline)],
    attachments: buildQuoteAttachments(stackChunks),
  };
};

export type SlackOption = {
  iconUrl?: string;
  botName?: string;
  blocks?: unknown[];
  attachments?: unknown[];
};

type SlackPostParam = {
  text: string;
  link_names: 0 | 1;
  username: string;
  icon_url?: string;
  icon_emoji?: string;
  blocks?: unknown[];
  attachments?: unknown[];
};

const defaultBotName = "Github Mention To Slack";
const defaultIconEmoji = ":bell:";

export const SlackRepositoryImpl = {
  postToSlack: async (
    webhookUrl: string,
    message: string,
    options?: SlackOption,
  ): Promise<string> => {
    const botName = (() => {
      const n = options?.botName;
      if (n && n !== "") {
        return n;
      }
      return defaultBotName;
    })();

    const slackPostParam: SlackPostParam = {
      text: message,
      link_names: 0,
      username: botName,
    };

    const u = options?.iconUrl;
    if (u && u !== "") {
      slackPostParam.icon_url = u;
    } else {
      slackPostParam.icon_emoji = defaultIconEmoji;
    }

    if (options?.blocks && options.blocks.length > 0) {
      slackPostParam.blocks = options.blocks;
    }

    if (options?.attachments && options.attachments.length > 0) {
      slackPostParam.attachments = options.attachments;
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackPostParam),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to post to Slack: ${response.status} ${response.statusText}`,
      );
    }

    return response.text();
  },
};
