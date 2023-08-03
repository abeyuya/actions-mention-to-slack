module.exports = {
  automock: false,
  moduleFileExtensions: ["ts", "js"],
  modulePathIgnorePatterns: ["fixture"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
      },
    ],
  },
};
