# MailerLite for EmDash

A read-only MailerLite integration for [EmDash CMS](https://emdashcms.com), developed by [eCommerce Ave](https://ecommerceave.com).

Connect your MailerLite account to EmDash and view subscriber statistics, subscriber groups, email campaigns, and signup forms directly from your CMS dashboard.

## Features

- **Subscriber Overview** — View the total number of subscribers in your MailerLite account.
- **Subscriber Groups** — View your MailerLite groups and their active subscriber counts.
- **Recent Campaigns** — View recent email campaigns and their statuses.
- **Signup Forms** — View counts for embedded forms, pop-ups, and promotions.
- **Form Details** — View form names and available status information.
- **Manual Refresh** — Retrieve updated information from MailerLite whenever needed.
- **Secure API Configuration** — Store your MailerLite API key using EmDash's secret settings.

### Embedded Form Status

Embedded forms display a readiness indicator based on information returned by the MailerLite API:

- **Ready to Embed** — The form has content and no reported problems.
- **Needs Attention** — The form is broken or has missing subscriber groups.
- **Not Ready** — The form has no content.
- **Status unavailable** — The API did not provide enough information to determine readiness.

A form marked Ready to Embed is not necessarily installed or actively receiving submissions on a website.

## Requirements

- EmDash CMS with support for sandboxed plugins
- A MailerLite account using the current MailerLite API
- A valid MailerLite API key

## Installation

Install the plugin into an EmDash site using the supported sandboxed plugin installation process.

For local development, clone the repository:

```sh
git clone https://github.com/ecommerceave/emdash-mailerlite.git
cd emdash-mailerlite
pnpm install
```

Build the plugin:

```sh
pnpm run build
```

To test against a local EmDash site, run `pnpm run dev` in the plugin directory and add the local package to your EmDash project.

Import the plugin:

```ts
import emdashMailerlite from "emdash-mailerlite";
```

Then register it with EmDash:

```ts
emdash({
  sandboxed: [emdashMailerlite],
});
```

## Configuration

### 1. Generate a MailerLite API key

1. Sign in to your MailerLite account.
2. Navigate to **Integrations**.
3. Open the MailerLite API section.
4. Generate an API token for the integration.
5. Copy the token and store it securely.

### 2. Configure EmDash

1. Open your EmDash administration dashboard.
2. Navigate to **Plugins**.
3. Locate the MailerLite plugin.
4. Open its settings.
5. Enter your MailerLite API key.
6. Save the settings.

### 3. Connect your account

1. Open the **MailerLite** page in EmDash.
2. Click **Refresh MailerLite Data**.
3. The plugin will verify the API connection and retrieve available MailerLite information.

Once connected, the dashboard displays your account statistics.

## Read-Only Integration

This plugin is designed for viewing MailerLite account information inside EmDash.

It does not:

- Create, edit, or delete subscribers.
- Modify subscriber groups.
- Create or send email campaigns.
- Create or modify signup forms.
- Automatically embed signup forms into website pages.

Manage these features directly through your MailerLite account.

## Security and Permissions

The plugin uses EmDash's sandboxed plugin architecture.

Its manifest requests the following capability:

```json
"capabilities": ["network:request"]
```

Network requests are restricted to:

```json
"allowedHosts": ["connect.mailerlite.com"]
```

The MailerLite API key is configured as a secret setting.

The plugin stores retrieved dashboard information using EmDash's plugin key-value storage.

API requests are made to MailerLite's API over HTTPS.

## Development

Install dependencies:

```sh
pnpm install
```

Validate and test the plugin:

```sh
pnpm run validate
pnpm run typecheck
pnpm run test
pnpm run build
```

For local development:

```sh
pnpm run dev
```

The development command rebuilds the plugin when source files change.

## Publishing

The EmDash plugin CLI supports publishing plugin artifacts.

```sh
pnpm run login -- your-publisher-domain.com
pnpm run publish
```

For GitHub Actions publishing setup:

```sh
pnpm run release:setup
```

The plugin version is managed through `package.json`.

Changes to capabilities, allowed hosts, or storage permissions require a version bump.

## Repository

[github.com/ecommerceave/emdash-mailerlite](https://github.com/ecommerceave/emdash-mailerlite)

## License

Licensed under the MIT License.

## Author

Developed and maintained by **eCommerce Ave**.

Website: [ecommerceave.com](https://ecommerceave.com)

Security contact: hello@ecommerceave.com
