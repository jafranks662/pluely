# Building a Windows MSI for Pluely

This document explains how to build a Windows MSI installer for Pluely locally and in CI (GitHub Actions).

Prerequisites (local Windows machine):

- Visual Studio Build Tools (MSVC) installed (or full Visual Studio). Ensure MSVC toolchain is available.
- Rust toolchain with the MSVC target: `rustup toolchain install stable-x86_64-pc-windows-msvc` and `rustup target add x86_64-pc-windows-msvc`.
- WiX Toolset installed (v3.11 or v4). You can install via Chocolatey: `choco install wixtoolset -y`.
- Node.js (recommended v20+) and npm.

Local build steps:

1. Install npm deps:

```
npm ci
```

2. Build frontend assets:

```
npm run build
```

3. Build the Tauri bundle (this will create the MSI if WiX is present):

```
npm run tauri -- build
```

Or use the convenience script:

```
npm run build:msi
```

Output

- The built MSI is typically at `src-tauri/target/release/bundle/msi/Pluely-<version>.msi` (or under the `x86_64-pc-windows-msvc` triplet path).

CI (GitHub Actions)

- A workflow has been added at `.github/workflows/build-windows-msi.yml`. It runs on `windows-latest`, installs WiX, builds, and uploads the generated MSI as an artifact named `pluely-windows-msi`.

Notes

- Building MSI requires the native Windows toolchain (MSVC) and WiX. Cross-building an MSI from Linux/macOS is not supported without complex cross-compilation setups.

Code signing (recommended)

To sign the generated MSI and executables in CI, the workflow supports using a PFX certificate supplied via repository secrets.

Secrets to add in your repository settings:

- `WINDOWS_PFX_BASE64` — the base64-encoded contents of your `.pfx` file.
- `WINDOWS_PFX_PASSWORD` — the password for the `.pfx` file.
- `SIGNING_TIMESTAMP_URL` (optional) — timestamp server URL (defaults to `http://timestamp.digicert.com`).

How to produce the base64 PFX value:

- On Windows PowerShell:

```
[Convert]::ToBase64String([IO.File]::ReadAllBytes('path\\to\\cert.pfx')) | Out-File -Encoding ascii cert.pfx.b64
Get-Content cert.pfx.b64 | Set-Clipboard
```

- On macOS / Linux:

```
base64 -w0 cert.pfx | pbcopy   # or copy stdout manually
```

The workflow will decode `WINDOWS_PFX_BASE64` to `cert.pfx`, use `signtool.exe` to sign any `.msi` and `.exe` under `src-tauri/target`, then remove the temporary `cert.pfx` file. If `signtool` is not available on the runner the signing step will be skipped.

Security note: Keep the PFX value and password in repository secrets (or organization secrets). Consider using time-limited certificates or a secure signing server for production builds.
