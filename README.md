# Repbook

A small workout tracker for your NAS. One Docker container, one SQLite database, no cloud account and no third-party runtime packages. Requires Node 24; the Docker image supplies it.

## Install on your Ugreen NAS

### Install the ready-built GitHub image

Each push to `main` runs checks, smoke-tests the container, then publishes `ghcr.io/h3artbrake/repbook:latest` and a commit-specific tag. This image targets the x86-64 architecture used by the DXP4800 Plus. Check that the repository's **Actions** run succeeds before installing it.

The repository is public. Once the container package is public, the NAS can pull it without a GitHub login. If a pull returns an authentication error, check that the package visibility is Public under GitHub Packages → repbook → Package settings.

Create a Docker Compose project from `compose.nas.yaml`. Set `REPBOOK_IMAGE` to your lowercase image address and `APP_ORIGIN` to your HTTPS Tailscale address. The remaining Tailscale setup is described below. If the interface does not read `.env`, enter the values in the project's environment configuration.

To update, back up first, pull the latest image and recreate the same project:

```sh
docker compose -f compose.nas.yaml pull
docker compose -f compose.nas.yaml up -d
```

Keep the project name unchanged to reuse its data volume. For a rollback, set `REPBOOK_IMAGE` to a previous successful commit tag and recreate the container. If switching from the source-build Compose file, use the same Compose project name and confirm it references the existing `repbook-data` volume.

### Build from source instead

1. Extract this folder somewhere permanent on the NAS, for example in a shared `docker/repbook` folder. Keep `compose.yaml`, `Dockerfile`, `server.mjs`, `seed.mjs`, `package.json` and `public/` together.
2. In Ugreen's Docker interface, create a Compose project using this folder and `compose.yaml`. Build and start it. Interface labels can vary by UGOS version. If the interface cannot build a local Dockerfile, use the two commands below once from the project folder via SSH.

   ```sh
   docker compose build
   docker compose up -d
   ```

3. With Tailscale **running on the NAS host** (or a Tailscale container using host networking), enable a private HTTPS address:

   ```sh
   tailscale serve --bg http://127.0.0.1:3000
   tailscale serve status
   ```

   Run the command where the Tailscale daemon runs. A bridged Tailscale container has its own `localhost` and cannot reach the host mapping that way. For a bridged installation, use your existing HTTPS reverse proxy or change the Tailscale setup to reach this service; the supplied Compose file assumes host-level Tailscale. Tailscale Serve may ask you to enable HTTPS in your tailnet. If port 443 already serves another app, use a separate port, for example `tailscale serve --bg --https=8443 http://127.0.0.1:3000`, and include `:8443` in the app address.

4. Copy `.env.example` to `.env`. Set `APP_ORIGIN` to the exact `https://...ts.net` address printed by Serve, including a port if applicable, and set `COOKIE_SECURE=true`. Recreate the Compose project/container to apply the environment variables. If your Docker interface does not read `.env`, enter those two environment values in the project's configuration.
5. Open that HTTPS address while connected to Tailscale and create the first account. It becomes the owner account. In Settings you can add users; each has private templates and history. There is no public registration after setup.

The published Docker port binds to the NAS loopback address. Access goes through your Tailscale HTTPS endpoint. Use Tailscale Serve, not Funnel, for private access. Keep this app at the root of its own address rather than under `/repbook`.

## Install on your phone

Connect Tailscale and open the **HTTPS** app address. Safari on iPhone: Share → Add to Home Screen. On Android: the browser's Install app/Add to Home Screen option. Desktop Chromium browsers also offer installation. Plain `http://NAS-IP:3000` is not a suitable PWA installation address.

The app caches its interface, not authenticated API responses. If an already-open workout loses the connection, edits stay in a user-scoped draft on that device and retry every 15 seconds or on reconnection. Reopening or signing in requires the NAS. On reopening, an unsaved draft is recovered after sign-in. Use trusted devices: unsaved drafts are in browser storage until synced. Conflicting edits from another device are never silently overwritten; export the local copy, then reload the NAS copy and reconcile it manually.

## Logging

Use **Start empty session** on Workouts or Session to log an unplanned workout. Add exercises as you go, including custom exercises from the session picker. Freestyle sessions save to history and progress like template workouts, without creating a template.

- The three screenshot days are starter templates. Edit names, add/remove/reorder exercises, or make new templates. Day 2 starts with hip thrust; glute bridge is also in the exercise list. Chin-ups occur once on Day 3.
- Start a workout, enter **actual** reps and kg, each set with reps is logged automatically. Add sets as needed or use the last session to copy the last weights into rows with blank reps. Finish to add the workout to history.
- Blank weight means bodyweight. Positive kg is ordinary weight (or added weight for bodyweight exercises). Enter negative kg for assistance; it is stored separately as assistance.
- Enter dumbbell weight per dumbbell and single-side reps per side. Use the same convention each time. Volume is based on exactly the entered load; no inferred doubling or body mass.
- Templates affect future sessions. History preserves the exercise names recorded at the time. History → View → Edit lets you correct past entries; dates can be backdated.
- New sessions start with one blank row per exercise. New rows have blank reps and do not count until you enter reps.

## Progress and optional hints

Progress opens with mini-graph cards for exercises you have actually logged, most recent first. Search by name or use the Upper body, Lower body, Core and Other dropdown. These controls are also available in workout lists, history and exercise pickers. Mixed workouts appear under each included area. Tap a card, or an exercise name during a session, for its full graph and actual sets. The graph automatically follows the most common load type in the latest session: heaviest weight, added weight, bodyweight reps, or least assistance. Only when you have logged different load types do relevant tabs appear. Dates are spaced in real elapsed time. Multiple sessions on the same date are retained separately. The interface uses neutral charcoal surfaces with limited pink highlights; session logging has no notes field. Notes in older backups are preserved.

Hints are deterministic arithmetic, not coaching. They repeat the previous set count. With at least two completed sets at the same load and load type, if every set reaches the upper rep threshold, the hint suggests one equipment increment more (or one increment less assistance). Otherwise it suggests repeating the previous baseline and working toward the chosen rep threshold. Bodyweight sets get an optional extra-rep hint. Mixed loads do not get an automatic increase. Defaults are an editable 8–12 rep range and a 1 or 2.5 kg step. These thresholds are preferences, not individual recommendations. Hints cannot assess form, effort, fatigue or readiness. Turn them off in Settings.

## Backup, restore and updates

**Simple backup:** Settings → Export backup downloads the current account's plans, history and active session. Import restores a version 1 Repbook JSON backup, replacing only the signed-in account's workout data. Passwords and other users are not included.

**Full NAS backup:** Stop the container, then back up the entire `repbook-data` named volume through your Docker/backup tooling. Restore the whole volume while the container is stopped. This includes users and password hashes. Do not copy only the live `.sqlite` file while the service is writing; SQLite uses companion WAL files. Keep the Compose project name stable so updates reuse the same volume.

To update, back up first, replace the app files and rebuild/recreate the container. **Do not delete the data volume** or run `docker compose down -v`. This first release uses schema version 1.

Passwords are hashed with scrypt. Sessions use HttpOnly/SameSite cookies and expire after 30 days. Changing a password signs out other sessions. The initial owner can create users; there is no email/password-reset service or user-removal UI in this minimal version. Keep your owner password in a password manager.

## Local development and checks

```sh
npm start
npm test
npm run check
```

Open `http://localhost:3000`. No dependency installation or frontend build is required. `DATA_DIR`, `PORT`, `HOST`, `APP_ORIGIN` and `COOKIE_SECURE` can be set in the environment. Defaults are a local `data/` folder, port 3000, all interfaces, the current HTTP host, and a non-Secure development cookie. Production HTTPS automatically enables Secure cookies when `APP_ORIGIN` begins with `https:`.

## Verified scope

The included tests cover account setup, sign-in, user isolation, stale-write protection, validation, persistence, backup restore, progression rules and chart calculations. Docker execution and phone installation need verification on your NAS; Docker was not available in the build workspace.

References: [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve), [Serve CLI](https://tailscale.com/docs/reference/tailscale-cli/serve), [PWA installation requirements](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [Node SQLite](https://nodejs.org/api/sqlite.html).
