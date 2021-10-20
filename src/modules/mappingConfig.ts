import axios from "axios";

export const MappingConfigRepositoryImpl = {
  downloadFromUrl: async (url: string) => {
    const response = await axios.get<string>(url);
    return response.data;
  },
};
