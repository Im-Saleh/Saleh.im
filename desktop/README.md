# Vault — native Linux app (C++ · Qt6 · libsodium)

A real, native desktop password manager for **Ubuntu / Kubuntu** and any
Debian-based distro — written in **C++ with Qt6** and **libsodium**. Not a web
wrapper: it launches straight from your applications menu and runs entirely
offline. Nothing is ever uploaded.

## Security

- **Argon2id** memory-hard key derivation (Fast 64 MB / Recommended 256 MB /
  Paranoid 1 GB presets).
- **XChaCha20-Poly1305** authenticated encryption; the file header is bound as
  additional authenticated data, so any tampering fails loudly.
- Optional **keyfile** second factor — the effective key becomes
  `BLAKE2b(password ‖ BLAKE2b(keyfile))`.
- Keys derived into wiped buffers (`sodium_memzero`); the vault file is `0600`.
- The crypto core ships with a self-test (`./build.sh --test`) validated
  against RFC 6238 / RFC 2202 vectors.

## Features (20+)

Master-password unlock · optional keyfile · create/edit/delete · five item
types (login, 2FA, note, card, identity) · **RFC-6238 TOTP** with live
countdown · password **generator** + **passphrase** generator · strength meter ·
search · folders · tags · favorites · clipboard **auto-clear** · **auto-lock**
on idle · lock on minimize · **system tray** · keyboard shortcuts
(Ctrl+L/F/N/G/Q) · reveal/hide · **password history** · **security audit**
(weak/reused/old/no-2FA/insecure) · **encrypted backup** export · change master
password · dark/light theme · configurable Argon2 strength · open-URL · secure
wipe.

## Build & install

```bash
cd desktop
./build.sh --install-deps   # first time only (installs Qt6 + libsodium + cmake)
./build.sh                  # builds and packages saleh-vault_1.0.0_amd64.deb
sudo apt install ./build/saleh-vault_1.0.0_amd64.deb
```

Then launch **Vault** from your apps menu (GNOME or KDE), or run `saleh-vault`.

Other options:

```bash
./build.sh --run       # build & launch without packaging
./build.sh --test      # build & run the crypto self-test
./build.sh --install   # build then install system-wide (no .deb)
./build.sh --clean     # fresh build
```

Uninstall: `sudo apt remove saleh-vault`.

## Requirements

- Ubuntu/Kubuntu: `build-essential cmake qt6-base-dev libsodium-dev`
- Fedora: `gcc-c++ cmake qt6-qtbase-devel libsodium-devel rpm-build`

Everything is local and open source. Your master password never leaves the
machine.
