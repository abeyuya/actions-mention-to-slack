import axios from "axios";

const pattern = /https?:\/\/[-_.!~*'()a-zA-Z0-9;/?:@&=+$,%#]+/g;
export const isUrl = (text: string) => pattern.test(text);

export const MappingConfigRepositoryImpl = {
  downloadFromUrl: async (url: string) => {
    const response = await axios.get<string>(url);
    return response.data;
  },
};
