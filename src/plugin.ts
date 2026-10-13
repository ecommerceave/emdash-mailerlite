
import {
  pluginRoute,
  type PluginContext,
  type SandboxedPlugin,
} from "emdash/plugin";

import {
  blocks,
  elements,
  type BlockInteraction,
  type BlockResponse,
} from "@emdash-cms/blocks/server";

type MailerLiteConnectionResult = {
  ok: boolean;
  error?: string;
};

type MailerLiteGroup = {
  name: string;
  subscriberCount: number;
};

type MailerLiteCampaign = {
  name: string;
  status: string;
};

type MailerLiteForm = {
  name: string;
  active: boolean | null;
  hasContent: boolean | null;
  isBroken: boolean | null;
  hasMissingGroups: boolean | null;
};

type MailerLiteFormType = "popup" | "embedded" | "promotion";

type MailerLiteFormsResult = {
  type: MailerLiteFormType;
  loaded: boolean;
  forms: MailerLiteForm[];
  total: number | null;
};

type SavedMailerLiteConnection = {
  verifiedAt: string;
  subscriberCount: number;
  groups: MailerLiteGroup[];
  campaigns: MailerLiteCampaign[];
  campaignsLoaded: boolean;
  forms?: MailerLiteFormsResult[];
};

const MAILERLITE_CONNECTION_KEY = "mailerliteConnection";

const FORM_TYPES: Array<{
  type: MailerLiteFormType;
  label: string;
}> = [
  { type: "popup", label: "Pop-ups" },
  { type: "embedded", label: "Embedded Forms" },
  { type: "promotion", label: "Promotions" },
];

function getFormStatus(
  form: MailerLiteForm,
  type: MailerLiteFormType,
): string {
  // Embedded forms can be ready to use even when the
  // MailerLite API reports active: false.
  if (type === "embedded") {
    if (form.isBroken === true || form.hasMissingGroups === true) {
      return "Needs Attention";
    }

    if (form.hasContent === false) {
      return "Not Ready";
    }

    if (
      form.hasContent === true &&
      form.isBroken === false &&
      form.hasMissingGroups === false
    ) {
      return "Ready to Embed";
    }

    return "Status unavailable";
  }

  // Use the API's active property for other form types.
  if (form.active === true) {
    return "Active";
  }

  if (form.active === false) {
    return "Inactive";
  }

  return "Status unavailable";
}

async function testMailerLiteConnection(
  ctx: PluginContext,
): Promise<MailerLiteConnectionResult> {
  const apiKey = await ctx.settings.get<string>("mailerliteApiKey");

  if (!apiKey) {
    await ctx.kv.delete(MAILERLITE_CONNECTION_KEY);

    return {
      ok: false,
      error: "MailerLite API key is not configured.",
    };
  }

  if (!ctx.http) {
    return {
      ok: false,
      error: "Network access is not available.",
    };
  }

  try {
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    };

    // Verify connection and retrieve subscriber count.
    const response = await ctx.http.fetch(
      "https://connect.mailerlite.com/api/subscribers?limit=0",
      {
        method: "GET",
        headers,
      },
    );

    if (!response.ok) {
      await ctx.kv.delete(MAILERLITE_CONNECTION_KEY);

      return {
        ok: false,
        error: `MailerLite API returned HTTP ${response.status}.`,
      };
    }

    const subscriberData = (await response.json()) as {
      total?: number;
    };

    const subscriberCount = subscriberData.total ?? 0;

    // Retrieve subscriber groups.
    let groups: MailerLiteGroup[] = [];

    try {
      const groupsResponse = await ctx.http.fetch(
        "https://connect.mailerlite.com/api/groups?limit=100",
        {
          method: "GET",
          headers,
        },
      );

      if (groupsResponse.ok) {
        const groupsData = (await groupsResponse.json()) as {
          data?: Array<{
            name: string;
            active_count?: number;
          }>;
        };

        groups = (groupsData.data ?? []).map((group) => ({
          name: group.name,
          subscriberCount: group.active_count ?? 0,
        }));
      } else {
        console.warn(
          `MailerLite groups API returned HTTP ${groupsResponse.status}.`,
        );
      }
    } catch {
      console.warn("Unable to retrieve MailerLite groups.");
    }

    // Retrieve recent email campaigns.
    let campaigns: MailerLiteCampaign[] = [];
    let campaignsLoaded = false;

    try {
      const campaignsResponse = await ctx.http.fetch(
        "https://connect.mailerlite.com/api/campaigns?limit=10",
        {
          method: "GET",
          headers,
        },
      );

      if (campaignsResponse.ok) {
        const campaignsData = (await campaignsResponse.json()) as {
          data?: Array<{
            name?: string;
            status?: string;
          }>;
        };

        campaigns = (campaignsData.data ?? []).map((campaign) => ({
          name: campaign.name ?? "Untitled campaign",
          status: campaign.status ?? "Unknown",
        }));

        campaignsLoaded = true;
      } else {
        console.warn(
          `MailerLite campaigns API returned HTTP ${campaignsResponse.status}.`,
        );
      }
    } catch {
      console.warn("Unable to retrieve MailerLite campaigns.");
    }

    // Retrieve all three MailerLite form types.
    const forms: MailerLiteFormsResult[] = [];

    for (const { type } of FORM_TYPES) {
      const result: MailerLiteFormsResult = {
        type,
        loaded: false,
        forms: [],
        total: null,
      };

      try {
        const formsResponse = await ctx.http.fetch(
          `https://connect.mailerlite.com/api/forms/${type}?limit=100`,
          {
            method: "GET",
            headers,
          },
        );

        if (formsResponse.ok) {
          const formsData = (await formsResponse.json()) as {
            data?: Array<{
              name?: string;
              active?: boolean;
              has_content?: boolean;
              is_broken?: boolean;
              has_missing_groups?: boolean;
            }>;
            meta?: {
              total?: number;
            };
          };

          result.forms = (formsData.data ?? []).map((form) => ({
            name: form.name ?? "Untitled form",
            active:
              typeof form.active === "boolean"
                ? form.active
                : null,
            hasContent:
              typeof form.has_content === "boolean"
                ? form.has_content
                : null,
            isBroken:
              typeof form.is_broken === "boolean"
                ? form.is_broken
                : null,
            hasMissingGroups:
              typeof form.has_missing_groups === "boolean"
                ? form.has_missing_groups
                : null,
          }));

          result.total = formsData.meta?.total ?? result.forms.length;
          result.loaded = true;
        } else {
          console.warn(
            `MailerLite ${type} forms API returned HTTP ${formsResponse.status}.`,
          );
        }
      } catch {
        console.warn(
          `Unable to retrieve MailerLite ${type} forms.`,
        );
      }

      forms.push(result);
    }

    // Save connection information and statistics.
    await ctx.kv.set(MAILERLITE_CONNECTION_KEY, {
      verifiedAt: new Date().toISOString(),
      subscriberCount,
      groups,
      campaigns,
      campaignsLoaded,
      forms,
    });

    return { ok: true };
  } catch {
    await ctx.kv.delete(MAILERLITE_CONNECTION_KEY);

    return {
      ok: false,
      error: "Unable to connect to MailerLite.",
    };
  }
}

async function buildAdminPage(
  ctx: PluginContext,
  connectionResult?: MailerLiteConnectionResult,
): Promise<BlockResponse> {
  const apiKey = await ctx.settings.get<string>("mailerliteApiKey");

  const savedConnection =
    await ctx.kv.get<SavedMailerLiteConnection>(
      MAILERLITE_CONNECTION_KEY,
    );

  const connected = connectionResult
    ? connectionResult.ok
    : Boolean(savedConnection && apiKey);

  const groups = savedConnection?.groups ?? [];
  const campaigns = savedConnection?.campaigns ?? [];
  const forms = savedConnection?.forms ?? [];

  const allFormsLoaded = FORM_TYPES.every(({ type }) =>
    forms.some((form) => form.type === type && form.loaded),
  );

  const totalForms = forms.reduce(
    (sum, form) => sum + (form.total ?? 0),
    0,
  );

  return {
    blocks: [
      blocks.header("MailerLite"),

      blocks.section(
        "View your MailerLite subscribers, groups, email campaigns, and signup forms directly in EmDash.",
      ),

      // Connection and subscriber statistics.
      blocks.fields([
        {
          label: "Total Subscribers",
          value:
            savedConnection?.subscriberCount?.toLocaleString() ??
            "Not available",
        },
        {
          label: "Connection Status",
          value: !apiKey
            ? "Needs setup"
            : connected
              ? "Connected"
              : connectionResult?.error
                ? "Connection failed"
                : "Not tested",
        },
        {
          label: "Connection Details",
          value: !apiKey
            ? "Add your MailerLite API key in plugin settings."
            : connected
              ? "MailerLite credentials verified successfully."
              : connectionResult?.error ??
                "Click Refresh MailerLite Data to verify your credentials.",
        },
        {
          label: "Last Verified",
          value: savedConnection?.verifiedAt
            ? `${new Date(savedConnection.verifiedAt).toLocaleString(
                ctx.site.locale,
                { timeZone: "UTC" },
              )} UTC`
            : "Never",
        },
      ]),

      // Subscriber groups.
      blocks.header("Subscriber Groups"),

      blocks.fields(
        groups.length > 0
          ? groups.map((group) => ({
              label: group.name,
              value: group.subscriberCount.toLocaleString(),
            }))
          : [
              {
                label: "Groups",
                value: "No groups loaded yet.",
              },
            ],
      ),

      // Recent campaigns.
      blocks.header("Recent Campaigns"),

      blocks.fields(
        campaigns.length > 0
          ? campaigns.map((campaign) => ({
              label: campaign.name,
              value: campaign.status,
            }))
          : [
              {
                label: "Campaigns",
                value: savedConnection?.campaignsLoaded
                  ? "No campaigns found."
                  : "Campaigns not loaded yet.",
              },
            ],
      ),

      // Signup form statistics.
      blocks.header("Signup Forms"),

      blocks.fields([
        {
          label: "Total Forms",
          value: allFormsLoaded
            ? totalForms.toLocaleString()
            : "Not fully available",
        },
        ...FORM_TYPES.map(({ type, label }) => {
          const result = forms.find(
            (form) => form.type === type,
          );

          return {
            label,
            value: result?.loaded
              ? (result.total ?? 0).toLocaleString()
              : "Not loaded",
          };
        }),
      ]),

      // Individual form details.
      ...FORM_TYPES.flatMap(({ type, label }) => {
        const result = forms.find(
          (form) => form.type === type,
        );

        if (!result?.loaded || result.forms.length === 0) {
          return [];
        }

        return [
          blocks.header(`${label} Details`),

          blocks.fields(
            result.forms.map((form) => ({
              label: form.name,
              value: getFormStatus(form, type),
            })),
          ),
        ];
      }),

      // Refresh MailerLite data.
      blocks.actions([
        elements.button(
          "test-mailerlite-connection",
          "Refresh MailerLite Data",
          { style: "primary" },
        ),
      ]),
    ],
  };
}

const plugin: SandboxedPlugin = {
  routes: {
    admin: pluginRoute({
      methods: ["POST"],
      request: {
        body: "json",
      },
      handler: async (routeCtx, ctx) => {
        const interaction = routeCtx.input as BlockInteraction;

        if (
          interaction.type === "block_action" &&
          interaction.action_id === "test-mailerlite-connection"
        ) {
          const connection = await testMailerLiteConnection(ctx);
          const response = await buildAdminPage(ctx, connection);

          response.toast = {
            message: connection.ok
              ? "MailerLite data refreshed successfully."
              : connection.error ??
                "Unable to connect to MailerLite.",
            type: connection.ok ? "success" : "error",
          };

          return response;
        }

        return buildAdminPage(ctx);
      },
    }),

    testMailerLiteConnection: {
      handler: async (_routeCtx, ctx) =>
        testMailerLiteConnection(ctx),
    },
  },
};

export default plugin;
