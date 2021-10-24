import axios from "axios";

export const convertGithubTextToBlockquotesText = (githubText: string) => {
  const t = githubText
    .split("\n")
    .map((line, i) => {
      // fix slack layout collapse problem when first line starts with blockquotes.
      if (i === 0 && line.startsWith(">")) {
        return `>\n> ${line}`;
      }

      return `> ${line}`;
    })
    .join("\n");

  return t;
};

export const buildSlackPostMessage = (
  slackIdsForMention: string[],
  issueTitle: string,
  commentLink: string,
  githubBody: string,
  senderName: string
): string => {
  const mentionBlock = slackIdsForMention.map((id) => `<@${id}>`).join(" ");
  const body = convertGithubTextToBlockquotesText(githubBody);

  const message = [
    mentionBlock,
    `${slackIdsForMention.length === 1 ? "has" : "have"}`,
    `been mentioned at <${commentLink}|${issueTitle}> by ${senderName}`,
  ].join(" ");

  return `${message}\n${body}`;
};

const openIssueLink =
  "https://github.com/abeyuya/actions-mention-to-slack/issues/new";

export const buildSlackErrorMessage = (
  error: Error,
  currentJobUrl?: string
): string => {
  const jobTitle = "mention-to-slack action";
  const jobLinkMessage = currentJobUrl
    ? `<${currentJobUrl}|${jobTitle}>`
    : jobTitle;

  const issueBody = error.stack
    ? encodeURI(["```", error.stack, "```"].join("\n"))
    : "";

  const link = encodeURI(
    `${openIssueLink}?title=${error.message}&body=${issueBody}`
  );

  return [
    `❗ An internal error occurred in ${jobLinkMessage}`,
    "(but action didn't fail as this action is not critical).",
    `To solve the problem, please <${link}|open an issue>`,
    "",
    "```",
    error.stack || error.message,
    "```",
  ].join("\n");
};

export type SlackOption = {
  iconUrl?: string;
  botName?: string;
};

type SlackPostParam = {
  text: string;
  link_names: 0 | 1;
  username: string;
  icon_url?: string;
  icon_emoji?: string;
};

const defaultBotName = "Github Mention To Slack";
const defaultIconEmoji = ":bell:";

type SlackPostResult = Record<string, unknown>;

export const SlackRepositoryImpl = {
  postToSlack: async (
    webhookUrl: string,
    message: string,
    options?: SlackOption
  ): Promise<SlackPostResult> => {
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

    const result = await axios.post<SlackPostResult>(
      webhookUrl,
      JSON.stringify(slackPostParam),
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    return result.data;
  },
};
