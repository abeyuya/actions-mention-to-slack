import axios from "axios";
// import { FAILSAFE_SCHEMA } from "js-yaml";

export const buildTeamsPostMessage = (
  githubIdsForMention: string[],
  issueTitle: string,
  commentLink: string,
  githubBody: string,
  senderName: string
) => {
  console.log('buildTeamsPostMessage', githubIdsForMention, issueTitle, commentLink, githubBody, senderName);

  const mentionBlock = githubIdsForMention.map((id) => `@${id}`).join(" ");
  const body = githubBody
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n\n");

  const message = [
    mentionBlock,
    `${githubIdsForMention.length === 1 ? "has" : "have"}`,
    `been mentioned at [${issueTitle}](${commentLink}) by ${senderName}`,
  ].join(" ");

  const post: TeamsPostParam =  {
    headline: issueTitle,
    summary: 'New mention!',
    message: `${message}\n\n${body}`,
    mentions: githubIdsForMention,
    isAlert: true,
  }

  return post;
};

const openIssueLink =
  "https://github.com/abeyuya/actions-mention-to-slack/issues/new";

export const buildTeamsErrorMessage = (
  error: Error,
  currentJobUrl?: string
) => {
  console.log('buildSlackErrorMessage', error.message);
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

export type TeamsPostParam = {
  headline: string;
  summary: string;
  message: string;
  mentions: Array<string>;
  isAlert: boolean;
};

// const defaultBotName = "Github Mention To Slack";
// const defaultIconEmoji = ":bell:";
// const defaultAlert = true;

export const TeamsRepositoryImpl = {
  postToTeams: async (
    webhookUrl: string,   
    post: TeamsPostParam
  ) => {
    console.log('postToSlack', post);

    webhookUrl = "https://prod-01.westus2.logic.azure.com:443/workflows/8fb4771ed2cb4544bb227d71ddfd1a4c/triggers/manual/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=5IrVE7vGgQR_VaDpfKEv6WzC3z0PYdT0rQoimsvmgaQ"

    const test_post: TeamsPostParam = {
      headline: 'New issue notifcation',
      message: 'Goto this issue! [Test Issue](https://github.com/JustSlone/actions-mention-to-slack/issues/1#issuecomment-665969793)',
      summary: 'sadf',
      mentions: ['jslone'], 
      isAlert: true
    }
    console.log(test_post);

    await axios.post(webhookUrl, JSON.stringify(post), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
