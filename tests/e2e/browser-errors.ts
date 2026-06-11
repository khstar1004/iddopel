import type { Page } from "@playwright/test";

export function watchBrowserErrors(page: Page) {
  const messages: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      messages.push(`[${message.type()}] ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    messages.push(`[pageerror] ${error.message}`);
  });

  return messages;
}
