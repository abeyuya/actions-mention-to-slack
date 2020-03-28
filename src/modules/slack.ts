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

export const postToSlack = async (
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
    username: botName
  };

  const u = options?.iconUrl;
  if (u && u !== "") {
    slackPostParam.icon_url = u;
  } else {
    slackPostParam.icon_emoji = ":bell:";
  }

  await axios.post(webhookUrl, JSON.stringify(slackPostParam), {
    headers: { "Content-Type": "application/json" }
  });
};
