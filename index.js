"use strict";
exports.__esModule = true;
var core = require("@actions/core");
var github = require("@actions/github");
var pattern = /\B@[a-z0-9_-]+/gi;
var pickupUsername = function (text) {
    return text.match(pattern).map(function (username) { return username.replace("@", ""); });
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
var pickupBodyFromGithubPayload = function (payload) {
    if (payload.action === "opened" && payload.issue) {
        return payload.issue.body;
    }
    if (payload.action === "opened" && payload.pull_request) {
        return payload.pull_request.body;
    }
    if (payload.action === "created" && payload.comment) {
        return payload.comment.body;
    }
    throw new Error("unknown event hook: " + JSON.stringify(payload, undefined, 2));
};
try {
    var body = pickupBodyFromGithubPayload(github.context.payload);
    var usernames = pickupUsername(body);
    console.log("usernames: " + usernames);
    // TODO: convert to slack name
    // TODO: build slack post message
    // Get the JSON webhook payload for the event that triggered the workflow
    var payload = JSON.stringify(github.context.payload, undefined, 2);
    console.log("The event payload: " + payload);
}
catch (error) {
    core.setFailed(error.message);
}
