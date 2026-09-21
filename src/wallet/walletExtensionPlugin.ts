/**
 * Plug-and-play browser wallet extension adapter.
 *
 * Safety boundary: this module only requests the connected public address and
 * network. It never asks for seed phrases, private keys, or signing authority.
 */

export type WalletChain = 'evm' | 'bitcoin';

export interface WalletConnection {
  provider: 'eip1193' | 'unisat';
  chain: WalletChain;
  address: string;
  network: string;
}

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

export interface UnisatProvider {
  requestAccounts(): Promise<string[]>;
  getNetwork(): Promise<string>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

export interface WalletExtensionWindow {
  ethereum?: Eip1193Provider;
  unisat?: UnisatProvider;
}

export class WalletExtensionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletExtensionError';
  }
}

function browserWindow(): WalletExtensionWindow {
  if (typeof window === 'undefined') {
    throw new WalletExtensionError('Wallet extensions are only available in a browser.');
  }
  return window as unknown as WalletExtensionWindow;
}

/**
 * Detect installed providers without loading third-party SDKs.
 */
export function detectWalletExtensions(): { evm: boolean; bitcoin: boolean } {
  const current = typeof window === 'undefined' ? {} : browserWindow();
  return { evm: Boolean(current.ethereum), bitcoin: Boolean(current.unisat) };
}

/**
 * Connect to an installed wallet extension and return only public identity data.
 * Pass chain='evm' for MetaMask, Coinbase Wallet, Rabby, etc.; pass
 * chain='bitcoin' for UniSat-compatible Bitcoin extensions.
 */
export async function connectWalletExtension(
  chain: WalletChain,
  preferredProvider?: Eip1193Provider | UnisatProvider
): Promise<WalletConnection> {
  const current = browserWindow();

  if (chain === 'bitcoin') {
    const provider = (preferredProvider || current.unisat) as UnisatProvider | undefined;
    if (!provider?.requestAccounts || !provider.getNetwork) {
      throw new WalletExtensionError(
        'No UniSat-compatible Bitcoin wallet extension was detected.'
      );
    }
    const accounts = await provider.requestAccounts();
    const address = accounts[0];
    if (!address) throw new WalletExtensionError('The wallet returned no Bitcoin address.');
    return { provider: 'unisat', chain, address, network: await provider.getNetwork() };
  }

  const provider = (preferredProvider || current.ethereum) as Eip1193Provider | undefined;
  if (!provider?.request) {
    throw new WalletExtensionError('No EIP-1193 wallet extension was detected.');
  }
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
  const address = accounts?.[0];
  if (!address) throw new WalletExtensionError('The wallet returned no EVM address.');
  const chainId = String(await provider.request({ method: 'eth_chainId' }));
  return { provider: 'eip1193', chain, address, network: chainId };
}

/**
 * Subscribe to account/network changes so the application can clear stale
 * wallet state. The returned function removes the listeners when supported.
 */
export function watchWalletExtension(
  connection: WalletConnection,
  onChange: (...args: unknown[]) => void,
  providers?: WalletExtensionWindow
): () => void {
  const current = providers || browserWindow();
  const provider = connection.provider === 'unisat' ? current.unisat : current.ethereum;
  if (!provider?.on) return () => undefined;

  const events = connection.provider === 'unisat' ? ['accountsChanged', 'networkChanged'] : ['accountsChanged', 'chainChanged'];
  events.forEach((event) => provider.on?.(event, onChange));
  return () => events.forEach((event) => provider.removeListener?.(event, onChange));
}

/**
 * Convert a connection into the existing WalletManager-compatible record.
 */
export function toWalletRecord(connection: WalletConnection, id = 'browser-wallet') {
  return {
    id,
    address: connection.address,
    type: connection.chain === 'bitcoin' ? 'bitcoin' as const : 'ethereum' as const,
    label: `${connection.provider} ${connection.network}`,
    percentage: 0,
  };
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
    unisat?: UnisatProvider;
  }
}

export default connectWalletExtension;
