# BRIX Web Interface

This directory contains the standalone BRIX frontend, separate from the existing Better xCloud userscript in `../src`.

## Development

From this directory:

```sh
bun install
bun run dev
```

Vite prints the local development URL.

## Production build

```sh
bun run build
```

The generated site is written to `web/dist`.

## Design system

The initial component playground uses the Aqua design language by igorfelipeduca:
https://github.com/igorfelipeduca/aqua

The slider is based on Aqua's Radix UI slider implementation. This frontend is currently a UI prototype; it is not connected to Xbox sign-in or cloud streaming.
