import axios from "axios";

export const buildSlackPostMessage = (
  slackIdsForMention: string[],
  issueTitle: string,
  commentLink: string,
  githubBody: string
) => {
  const mentionBlock = slackIdsForMention.map(id => `<@${id}>`).join(" ");
  const body = githubBody
    .split("\n")
    .map(line => `> ${line}`)
    .join("\n");

  return [
    `${mentionBlock} mentioned at <${commentLink}|${issueTitle}>`,
    body
  ].join("\n");
};

type SlackOption = {
  text: string;
  link_names: 0 | 1;
  username: string;
  icon_url?: string;
  icon_emoji?: string;
};

const defaultBotName = "Github Mention To Slack";

export const postToSlack = async (
  webhookUrl: string,
  message: string,
  options?: {
    iconUrl?: string;
    botName?: string;
  }
) => {
  const botName = (() => {
    const n = options?.botName;
    if (n && n !== "") {
      return n;
    }
    return defaultBotName;
  })();

  const slackOption: SlackOption = {
    text: message,
    link_names: 0,
    username: botName
  };

  const u = options?.iconUrl;
  if (u && u !== "") {
    slackOption.icon_url = u;
  } else {
    slackOption.icon_emoji = ":bell:";
  }

  await axios.post(webhookUrl, JSON.stringify(slackOption), {
    headers: { "Content-Type": "application/json" }
  });
};
