import * as core from "@actions/core";
import * as github from "@actions/github";
import { WebhookPayload } from "@actions/github/lib/interfaces";
import axios from "axios";

const pickupUsername = (text: string) => {
  const pattern = /\B@[a-z0-9_-]+/gi;
  return text.match(pattern).map(username => username.replace("@", ""));
};

// const testPickupUsername = () => {
//   const text = "@jpotts18 what is up man? Are you hanging out with @kyle_clegg";
//   const usernames = pickupUsername(text);
//   console.log(usernames);

//   if (
//     usernames.length === 2 &&
//     usernames[0] === "jpotts18" &&
//     usernames[1] === "kyle_clegg"
//   ) {
//     console.log("pass! testPickupUsername");
//   } else {
//     throw new Error(`fail! testPickupUsername: ${usernames}`);
//   }
// };
// testPickupUsername();

const pickupInfoFromGithubPayload = (
  payload: WebhookPayload
): {
  body: string;
  title: string;
  url: string;
} => {
  if (payload.action === "opened" && payload.issue) {
    return {
      body: payload.issue.body,
      title: payload.issue.title,
      url: payload.issue.html_url
    };
  }

  if (payload.action === "opened" && payload.pull_request) {
    return {
      body: payload.pull_request.body,
      title: payload.pull_request.title,
      url: payload.pull_request.html_url
    };
  }

  if (payload.action === "created" && payload.comment) {
    if (payload.issue) {
      return {
        body: payload.comment.body,
        title: payload.issue.title,
        url: payload.comment.html_url
      };
    }

    if (payload.pull_request) {
      return {
        body: payload.comment.body,
        title: payload.pull_request.title,
        url: payload.comment.html_url
      };
    }
  }

  throw new Error(
    `unknown event hook: ${JSON.stringify(payload, undefined, 2)}`
  );
};

const buildSlackPostMessage = (
  slackUsernamesForMention: string[],
  issueTitle: string,
  commentLink: string,
  githubBody: string
) => {
  const mentionBlock = slackUsernamesForMention.map(n => `@${n}`).join(" ");

  return `
${mentionBlock} mentioned at <${commentLink}|${issueTitle}>
> ${githubBody}
`;
};

const postToSlack = async (webhookUrl: string, message: string) => {
  const slackOption = {
    text: message,
    link_names: 1,
    username: "Github Mention To Slack",
    icon_emoji: ":bell:"
  };

  await axios.post(webhookUrl, JSON.stringify(slackOption), {
    headers: { "Content-Type": "application/json" }
  });
};

// const testPostToSlack = async () => {
//   const message = buildSlackPostMessage(
//     ["abeyuya"],
//     "title of issue here",
//     "https://google.com",
//     "pr comment dummy @abeyuya"
//   );

//   try {
//     await postToSlack(process.env.SLACK_WEBHOOK_URL, message);
//   } catch (e) {
//     console.error(e);
//   }
// };
// testPostToSlack();

const main = async () => {
  try {
    const info = pickupInfoFromGithubPayload(github.context.payload);

    // TODO: convert to slack name
    const usernames = pickupUsername(info.body);

    const message = buildSlackPostMessage(
      usernames,
      info.title,
      info.url,
      info.body
    );

    await postToSlack(process.env.SLACK_WEBHOOK_URL, message);

    // Get the JSON webhook payload for the event that triggered the workflow
    const payload = JSON.stringify(github.context.payload, undefined, 2);
    console.log(`The event payload: ${payload}`);
  } catch (error) {
    core.setFailed(error.message);
  }
};

main();
