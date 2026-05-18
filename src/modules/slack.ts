export type SlackPostPayload = {
  text: string;
  blocks: unknown[];
};

// Slack section block text.text の上限は 3000 文字。安全余白を取って分割閾値を決める。
export const SECTION_TEXT_LIMIT = 2800;
export const CONTINUATION_SUFFIX = " (cont.)";

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

const buildHeaderAndBodyBlocks = (
  headline: string,
  body: string | null | undefined,
): unknown[] => {
  const blocks: unknown[] = [buildSection(headline)];
  if (body && body.length > 0) {
    blocks.push({ type: "divider" });
    for (const chunk of splitMrkdwnByLimit(body)) {
      blocks.push(buildSection(chunk));
    }
  }
  return blocks;
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

  return {
    text: headline,
    blocks: buildHeaderAndBodyBlocks(headline, githubBody),
  };
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

  return {
    text: headline,
    blocks: buildHeaderAndBodyBlocks(headline, reviewBody),
  };
};

export const buildSlackCommentToAuthorMessage = (
  prAuthorSlackUserId: string,
  prLink: string,
  commenter: string,
  commentBody: string | null | undefined,
): SlackPostPayload => {
  const headline = `<@${prAuthorSlackUserId}> ${prLink} received a comment from ${commenter}.`;

  return {
    text: headline,
    blocks: buildHeaderAndBodyBlocks(headline, commentBody),
  };
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
  const blocks: unknown[] = [buildSection(headline), { type: "divider" }];
  for (const chunk of splitMrkdwnByLimit(stack)) {
    blocks.push(buildSection(["```", chunk, "```"].join("\n")));
  }

  return {
    text: `❗ An internal error occurred in ${jobTitle}`,
    blocks,
  };
};

export type SlackOption = {
  iconUrl?: string;
  botName?: string;
  blocks?: unknown[];
};

type SlackPostParam = {
  text: string;
  link_names: 0 | 1;
  username: string;
  icon_url?: string;
  icon_emoji?: string;
  blocks?: unknown[];
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
