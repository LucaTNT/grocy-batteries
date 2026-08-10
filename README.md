# Grocy Batteries

A deliberately small, mobile-first dashboard for the battery tracker in [Grocy](https://grocy.info/). It shows your batteries, their most recent charge/replacement time, and provides one-tap tracking. The only other screen is a compact manager for adding, renaming, and deleting batteries.

It has no login page: the Grocy URL and API key stay server-side in the local app container. The browser only ever talks to this app, which proxies the required battery API calls to Grocy.

## Setup

1. In Grocy, create an API key in **Settings → Manage API keys**.
2. Copy the example environment file and fill in your local Grocy address and API key:

   ```sh
   cp .env.example .env
   ```

3. Start it with Docker:

   ```sh
   docker compose up --build -d
   ```

4. Open [http://localhost:3000](http://localhost:3000) on your phone or computer. To use it from a phone, replace `localhost` with the LAN address of the machine running Docker.

## Local development

No dependencies are needed. With Node.js 20 or newer:

```sh
cp .env.example .env
npm start
```

The app listens on `PORT` (default `3000`).

## Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `GROCY_URL` | Yes | Base URL of Grocy, e.g. `http://grocy.local` |
| `GROCY_API_KEY` | Yes | API key created in Grocy |
| `PORT` | No | Local listening port, defaults to `3000` |

## API access

The app uses only Grocy battery endpoints: generic battery CRUD at `/api/objects/batteries` and charge tracking at `/api/batteries/{id}/charge`. Its server forwards `GROCY-API-KEY` to Grocy, so no key is embedded in client-side JavaScript.

## Notes

- The *Charged* button records the current local time as a charge/replacement event.
- Existing batteries remain the source of truth in Grocy; this app adds no separate database.
- Keep this app on your trusted local network. Anyone who can access it can update the batteries available to the configured Grocy API key.
