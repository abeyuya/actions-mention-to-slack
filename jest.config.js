module.exports = {
  automock: false,
  moduleFileExtensions: ["ts", "js"],
  modulePathIgnorePatterns: ["fixture"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.json",
    },
  },
};
