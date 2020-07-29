import axios from "axios";

export const buildSlackPostMessage = (
  slackIdsForMention: string[],
  issueTitle: string,
  commentLink: string,
  githubBody: string,
  senderName: string
) => {
  const mentionBlock = slackIdsForMention.map((id) => `<@${id}>`).join(" ");
  const body = githubBody
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");

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
) => {
  const jobTitle = "mention-to-slack action";
  const jobLinkMessage = currentJobUrl
    ? `<${currentJobUrl}|${jobTitle}>`
    : jobTitle;

  return [
    `❗ An internal error occurred in ${jobLinkMessage}`,
    "(but action didn't fail as this action is not critical).",
    `To solve the problem, please copy and paste the text below and <${openIssueLink}|open an issue>`,
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

export const SlackRepositoryImpl = {
  postToSlack: async (
    webhookUrl: string,
    message: string,
    options?: SlackOption
  ) => {
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

    console.log('Posting message: ', slackPostParam);

    await axios.post(webhookUrl, JSON.stringify('{"text": "Test World"}'), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
