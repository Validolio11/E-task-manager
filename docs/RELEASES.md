# Windows releases and automatic updates

E-task uses SemVer (`MAJOR.MINOR.PATCH`). Keep the version synchronized in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.

## One-time repository setup

1. Store the updater private key in the GitHub repository secret `TAURI_SIGNING_PRIVATE_KEY`.
2. Add `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. The initially generated key has no password, so this secret can be empty or omitted.
3. Keep an offline backup of the key. Never commit it; `private/` is ignored.

The matching public key is embedded in `tauri.conf.json`. Existing app installations will only accept updates signed by that private key.

## Publishing a release

1. Run `npm run version:set -- 0.2.0` to update all three version fields safely.
2. Commit the version change.
3. Create and push a tag, for example `v0.1.0`.

The release workflow builds the Windows NSIS `setup.exe`, signs the updater artifact, publishes the GitHub Release, and generates `latest.json`. Installed copies read that manifest and can install the update from the app.
