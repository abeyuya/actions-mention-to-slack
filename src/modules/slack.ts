import * as core from "@actions/core";
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

export const postToSlack = async (
  webhookUrl: string,
  message: string,
  iconUrl?: string
) => {
  const botName = (() => {
    const n = core.getInput("bot-name", { required: false });
    if (n && n !== "") {
      return n;
    }
    return "Github Mention To Slack";
  })();

  const slackOption: SlackOption = {
    text: message,
    link_names: 0,
    username: botName
  };

  if (iconUrl && iconUrl !== "") {
    slackOption.icon_url = iconUrl;
  } else {
    slackOption.icon_emoji = ":bell:";
  }

  await axios.post(webhookUrl, JSON.stringify(slackOption), {
    headers: { "Content-Type": "application/json" }
  });
};
