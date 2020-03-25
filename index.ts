import * as core from "@actions/core";
import * as github from "@actions/github";
import { WebhookPayload } from "@actions/github/lib/interfaces";
import * as yaml from "js-yaml";
import axios from "axios";

const pickupUsername = (text: string) => {
  const pattern = /\B@[a-z0-9_-]+/gi;
  const hits = text.match(pattern);

  if (hits === null) {
    return [];
  }

  return hits.map(username => username.replace("@", ""));
};

// const testPickupUsername = () => {
//   const test1 = () => {
//     const text =
//       "@jpotts18 what is up man? Are you hanging out with @kyle_clegg";
//     const usernames = pickupUsername(text);

//     if (
//       usernames.length === 2 &&
//       usernames[0] === "jpotts18" &&
//       usernames[1] === "kyle_clegg"
//     ) {
//       console.log("pass! testPickupUsername.test1");
//     } else {
//       throw new Error(`fail! testPickupUsername.test1: ${usernames}`);
//     }
//   };
//   test1();

//   const test2 = () => {
//     const text = "no mention comment";
//     const usernames = pickupUsername(text);
//     if (usernames.length === 0) {
//       console.log("pass! testPickupUsername.test2");
//     } else {
//       throw new Error(`fail! testPickupUsername.test2: ${usernames}`);
//     }
//   };
//   test2();
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

  if (payload.action === "submitted" && payload.review) {
    return {
      body: payload.review.body,
      title: payload.pull_request.title,
      url: payload.review.html_url
    };
  }

  throw new Error(
    `unknown event hook: ${JSON.stringify(payload, undefined, 2)}`
  );
};

const buildSlackPostMessage = (
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

const loadNameMappingConfig = async (
  client: github.GitHub,
  configurationPath: string
) => {
  const configurationContent = await fetchContent(client, configurationPath);

  const configObject: { [githugUsername: string]: string } = yaml.safeLoad(
    configurationContent
  );
  return configObject;
};

const fetchContent = async (
  client: github.GitHub,
  repoPath: string
): Promise<string> => {
  const response: any = await client.repos.getContents({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    path: repoPath,
    ref: github.context.sha
  });

  return Buffer.from(response.data.content, response.data.encoding).toString();
};

const convertToSlackUsername = async (githubUsernames: string[]) => {
  const token = core.getInput("repo-token", { required: true });
  const configPath = core.getInput("configuration-path", { required: true });
  const githubClient = new github.GitHub(token);

  const mapping = await loadNameMappingConfig(githubClient, configPath);
  const slackIds = githubUsernames
    .filter(githubUsername => mapping[githubUsername] !== undefined)
    .map(githubUsername => mapping[githubUsername]);

  return slackIds;
};

const execPrReviewRequestedMention = async (payload: WebhookPayload) => {
  const requestedGithubUsernames = payload.pull_request.requested_reviewers.map(
    r => r.login
  );
  const slackIds = await convertToSlackUsername(requestedGithubUsernames);

  if (slackIds.length === 0) {
    return;
  }

  const title = payload.pull_request.title;
  const url = payload.pull_request.html_url;
  const requestUsername = payload.pull_request.user.login;

  const mentionBlock = slackIds.map(id => `<@${id}>`).join(", ");
  const message = `${mentionBlock} has been requested to review <${url}|${title}> by ${requestUsername}.`;

  const slackWebhookUrl = core.getInput("slack-webhook-url", {
    required: true
  });

  if (!slackWebhookUrl) {
    core.setFailed("Error! Need to set `slack-webhook-url` .");
    return;
  }

  await postToSlack(slackWebhookUrl, message);
};

const main = async () => {
  try {
    if (github.context.payload.action === "review_requested") {
      await execPrReviewRequestedMention(github.context.payload);
      return;
    }

    const info = pickupInfoFromGithubPayload(github.context.payload);

    const githubUsernames = pickupUsername(info.body);
    if (githubUsernames.length === 0) {
      return;
    }

    const slackIds = await convertToSlackUsername(githubUsernames);

    const message = buildSlackPostMessage(
      slackIds,
      info.title,
      info.url,
      info.body
    );

    const slackWebhookUrl = core.getInput("slack-webhook-url", {
      required: true
    });

    if (!slackWebhookUrl) {
      core.setFailed("Error! Need to set `slack-webhook-url` .");
      return;
    }

    await postToSlack(slackWebhookUrl, message);
  } catch (error) {
    core.setFailed(error.message);
  }
};

main();
