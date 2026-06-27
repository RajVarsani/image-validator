import axios from "axios";
import type { Fetcher } from "swr";

type Method = "get" | "post" | "put" | "delete";

/** Read fetcher: SWR key is `[url, 'get', ...args]`. */
export const genericAPIFetcher: Fetcher<any, any> = async ([url, type, ...rest]: [
  string,
  Method,
  ...any[],
]) => {
  return (await axios[type](url, ...rest)).data;
};

/** Write fetcher: `useSWRMutation(url, genericMutationFetcher)`, trigger({ type, rest }). */
export const genericMutationFetcher = async (
  url: string,
  { arg }: { arg: { type: Method; rest?: any[] } },
) => {
  return (await axios[arg.type](url, ...(arg.rest || []))).data;
};
