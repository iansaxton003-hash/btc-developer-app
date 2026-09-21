# @iansaxton/btc-wallet-extension

A dependency-free TypeScript client for connecting browser wallet extensions to Bitcoin and EVM applications. It is designed to be copied into an existing app or installed as a package with a minimal API.

## Install

```bash
npm install @iansaxton/btc-wallet-extension
```

## Quick start

```ts
import { createWalletClient } from '@iansaxton/btc-wallet-extension';

const wallet = createWalletClient();

if (!wallet.detect().bitcoin) {
  throw new Error('Install a UniSat-compatible Bitcoin wallet first.');
}

const connection = await wallet.connect('bitcoin');
console.log(connection.address, connection.network);

const stopWatching = wallet.watch(connection, () => {
  // Clear application state and ask the user to reconnect.
});

const walletRecord = wallet.toWalletRecord(connection, 'primary-wallet');
```

For MetaMask, Coinbase Wallet, Rabby, and other EIP-1193 providers, use `wallet.connect('evm')`.

## API

| API | Purpose |
| --- | --- |
| `createWalletClient(options?)` | Create a small state-light client. |
| `client.detect()` | Detect installed EVM and Bitcoin providers without prompting. |
| `client.connect('bitcoin' | 'evm')` | Request the public address and network from the wallet. |
| `client.watch(connection, callback)` | Watch account/network changes and return an unsubscribe function. |
| `client.toWalletRecord(connection, id?)` | Adapt the connection to the existing WalletManager record shape. |
| `connectWalletExtension(...)` | Functional equivalent for direct use. |

### SSR, testing, and custom bridges

Providers can be injected, which makes the package safe to use in SSR and deterministic tests:

```ts
const wallet = createWalletClient({
  providers: {
    ethereum: myEip1193Provider,
    unisat: myUnisatProvider,
  },
});
```

## Safety boundary

This package reads public wallet identity only. It does **not** request or store seed phrases, private keys, API keys, or signing authority. It does not send transactions, transfer funds, or perform payouts. Any future signing flow must display the exact transaction and use the wallet extension's own confirmation prompt.

The repository's existing cashout implementation is a placeholder and must not be treated as a real transfer implementation.

## Development

```bash
npm install
npm test
npm run pack:check
```

The package is built to `dist/` with CommonJS output and TypeScript declarations. The published package contains only `dist/`, `README.md`, and `LICENSE`.
