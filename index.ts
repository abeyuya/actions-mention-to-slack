import * as core from "@actions/core";
import * as github from "@actions/github";
import { WebhookPayload } from "@actions/github/lib/interfaces";

const pattern = /\B@[a-z0-9_-]+/gi;
const pickupUsername = (text: string) => {
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

const pickupBodyFromGithubPayload = (payload: WebhookPayload): string => {
  if (payload.action === "opened" && payload.issue) {
    return payload.issue.body;
  }

  if (payload.action === "opened" && payload.pull_request) {
    return payload.pull_request.body;
  }

  if (payload.action === "created" && payload.comment) {
    return payload.comment.body;
  }

  throw new Error(
    `unknown event hook: ${JSON.stringify(payload, undefined, 2)}`
  );
};

try {
  const body = pickupBodyFromGithubPayload(github.context.payload);
  const usernames = pickupUsername(body);
  console.log(`usernames: ${usernames}`);

  // TODO: convert to slack name
  // TODO: build slack post message

  // Get the JSON webhook payload for the event that triggered the workflow
  const payload = JSON.stringify(github.context.payload, undefined, 2);
  console.log(`The event payload: ${payload}`);
} catch (error) {
  core.setFailed(error.message);
}
