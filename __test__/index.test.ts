import { convertToSlackUsername } from "../src/index";

describe("src/index", () => {
  describe("convertToSlackUsername", () => {
    const mapping = {
      githubUser1: "slackUser1",
      githubUser2: "slackUser2"
    };

    it("should return hits slack member ids", async () => {
      const mock = {
        loadNameMappingConfig: jest.fn(async () => mapping)
      };

      const result = await convertToSlackUsername(
        ["githubUser1", "githubUser2"],
        mock,
        "",
        ""
      );

      expect(result).toEqual(["slackUser1", "slackUser2"]);
    });
  });
});
