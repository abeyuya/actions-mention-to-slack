import axios from "axios";
import { load } from "js-yaml";

const pattern = /https?:\/\/[-_.!~*'()a-zA-Z0-9;/?:@&=+$,%#]+/g;
export const isUrl = (text: string) => pattern.test(text);

export type MappingFile = {
  [githugUsername: string]: string | undefined;
};

export const MappingConfigRepositoryImpl = {
  downloadFromUrl: async (url: string) => {
    const response = await axios.get<string>(url);
    return response.data;
  },

  loadFromUrl: async (url: string) => {
    const data = await MappingConfigRepositoryImpl.downloadFromUrl(url);

    const configObject = load(data);

    if (configObject === undefined) {
      throw new Error(
        ["failed to load yaml", JSON.stringify({ url }, null, 2)].join("\n")
      );
    }

    return configObject as MappingFile;
  },
};
