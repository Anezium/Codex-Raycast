import { LocalStorage } from "@raycast/api";

const LAST_THREAD_ID_KEY = "last-thread-id";

export async function rememberLastThread(threadId: string) {
  await LocalStorage.setItem(LAST_THREAD_ID_KEY, threadId);
}

export async function getLastThreadId(): Promise<string | undefined> {
  return LocalStorage.getItem<string>(LAST_THREAD_ID_KEY);
}
