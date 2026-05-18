export type SlackPostPayload = {
  text: string;
  blocks: unknown[];
  attachments?: unknown[];
};

// Slack section block text.text の上限は 3000 文字。安全余白を取って分割閾値を決める。
export const SECTION_TEXT_LIMIT = 2800;
export const CONTINUATION_SUFFIX = " (cont.)";
// GitHub 公式 bot に近い、引用ブロックの縦線を模した中間グレー
const QUOTE_ATTACHMENT_COLOR = "#cccccc";

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

const buildQuoteAttachment = (chunks: string[]): unknown | null => {
  if (chunks.length === 0) return null;
  return {
    color: QUOTE_ATTACHMENT_COLOR,
    blocks: chunks.map((chunk) => buildSection(chunk)),
  };
};

const buildHeaderWithQuotedBody = (
  headline: string,
  body: string | null | undefined,
): SlackPostPayload => {
  const blocks: unknown[] = [buildSection(headline)];
  const bodyChunks = body && body.length > 0 ? splitMrkdwnByLimit(body) : [];
  const attachment = buildQuoteAttachment(bodyChunks);
  return {
    text: headline,
    blocks,
    ...(attachment ? { attachments: [attachment] } : {}),
  };
};

export const buildSlackPostMessage = (
  slackIdsForMention: string[],
  issueTitle: string,
  commentLink: string,
  githubBody: string,
  senderName: string,
): SlackPostPayload => {
  const mentionBlock = slackIdsForMention.map((id) => `<@${id}>`).join(" ");
  const verb = slackIdsForMention.length === 1 ? "has" : "have";
  const headline = `${mentionBlock} ${verb} been mentioned at <${commentLink}|${issueTitle}> by ${senderName}`;
  return buildHeaderWithQuotedBody(headline, githubBody);
};

export const buildSlackReviewSubmittedMessage = (
  prOwnerSlackUserId: string,
  prLink: string,
  reviewer: string,
  reviewState: string | undefined,
  reviewBody: string | null | undefined,
): SlackPostPayload => {
  const userMention = `<@${prOwnerSlackUserId}>`;
  const headline = (() => {
    switch (reviewState) {
      case "approved":
        return `${userMention} ${prLink} has been approved by ${reviewer}.`;
      case "changes_requested":
        return `${userMention} ${prLink} has changes requested by ${reviewer}.`;
      default:
        return `${userMention} ${prLink} received a review comment from ${reviewer}.`;
    }
  })();
  return buildHeaderWithQuotedBody(headline, reviewBody);
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
  const attachment = buildQuoteAttachment(stackChunks);

  return {
    text: `❗ An internal error occurred in ${jobTitle}`,
    blocks: [buildSection(headline)],
    ...(attachment ? { attachments: [attachment] } : {}),
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
