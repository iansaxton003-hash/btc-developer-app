# btc-developer-app

A small TypeScript wallet-extension integration for Bitcoin and EVM-compatible crypto applications.

## Plug-and-play wallet extension

`src/wallet/walletExtensionPlugin.ts` detects installed browser extensions and connects using public identity data only:

- **EVM wallets**: MetaMask, Coinbase Wallet, Rabby, and other [EIP-1193](https://eips.ethereum.org/EIPS/eip-1193) providers through `window.ethereum`.
- **Bitcoin wallets**: UniSat-compatible extensions through `window.unisat`.

No seed phrase, private key, API key, or automatic transfer is requested or stored.

```ts
import {
  connectWalletExtension,
  detectWalletExtensions,
  toWalletRecord,
  watchWalletExtension,
} from './src/wallet/walletExtensionPlugin';

const installed = detectWalletExtensions();
const connection = await connectWalletExtension(installed.bitcoin ? 'bitcoin' : 'evm');
const walletRecord = toWalletRecord(connection);
console.log(walletRecord.address, connection.network);

const stopWatching = watchWalletExtension(connection, () => {
  // Clear cached address and ask the user to reconnect after an account/network change.
});
```

## Integration boundary

This plugin intentionally stops at wallet discovery and public-address connection. A payout or transaction-signing flow must be implemented separately, display the exact transaction to the user, and require the wallet extension's own confirmation prompt. Do not put private keys or seed phrases into this repository or into server environment variables.

The existing cashout code is a placeholder and must not be treated as a real transfer implementation until it is replaced with a chain-specific, user-confirmed transaction flow.

## Build

```bash
npm install
npm run build
```
