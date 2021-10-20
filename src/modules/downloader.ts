import axios from "axios";

export const Downloader = {
  downloadMappingConfigFile: async (url: string) => {
    const response = await axios.get<string>(url);
    return response.data;
  },
};
