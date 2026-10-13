
import { afterEach, describe, expect, it } from "vitest";

import {
  createPluginTestHost,
  type PluginTestHost,
} from "@emdash-cms/plugin-test";

let host: PluginTestHost | undefined;

afterEach(async () => {
  await host?.dispose();
  host = undefined;
});

describe("MailerLite plugin", () => {
  it("returns a configuration error when no API key is set", async () => {
    host = await createPluginTestHost();

    const result = await host.invokeRoute(
      "testMailerLiteConnection",
    );

    expect(result).toEqual({
      ok: false,
      error: "MailerLite API key is not configured.",
    });
  });
});
