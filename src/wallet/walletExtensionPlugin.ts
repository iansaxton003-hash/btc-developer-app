/**
 * Plug-and-play browser wallet extension adapter.
 *
 * This package reads public wallet identity only. It never requests or stores
 * seed phrases, private keys, API keys, or transaction-signing authority.
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

export interface WalletClientOptions {
  /** Optional providers, useful for SSR, testing, and custom extension bridges. */
  providers?: WalletExtensionWindow;
}

export class WalletExtensionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletExtensionError';
  }
}

function browserProviders(): WalletExtensionWindow {
  if (typeof window === 'undefined') return {};
  return window as unknown as WalletExtensionWindow;
}

function resolveProviders(providers?: WalletExtensionWindow): WalletExtensionWindow {
  return providers || browserProviders();
}

/** Detect installed providers without triggering a wallet permission prompt. */
export function detectWalletExtensions(providers?: WalletExtensionWindow): {
  evm: boolean;
  bitcoin: boolean;
} {
  const current = resolveProviders(providers);
  return { evm: Boolean(current.ethereum), bitcoin: Boolean(current.unisat) };
}

/**
 * Connect to an installed wallet extension and return public identity data.
 * EVM covers EIP-1193 wallets such as MetaMask, Coinbase Wallet, and Rabby.
 * Bitcoin covers UniSat-compatible extensions.
 */
export async function connectWalletExtension(
  chain: WalletChain,
  preferredProvider?: Eip1193Provider | UnisatProvider,
  providers?: WalletExtensionWindow
): Promise<WalletConnection> {
  const current = resolveProviders(providers);

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

/** Subscribe to account/network changes; returns an unsubscribe function. */
export function watchWalletExtension(
  connection: WalletConnection,
  onChange: (...args: unknown[]) => void,
  providers?: WalletExtensionWindow
): () => void {
  const current = resolveProviders(providers);
  const provider = connection.provider === 'unisat' ? current.unisat : current.ethereum;
  if (!provider?.on) return () => undefined;

  const events = connection.provider === 'unisat'
    ? ['accountsChanged', 'networkChanged']
    : ['accountsChanged', 'chainChanged'];
  events.forEach((event) => provider.on?.(event, onChange));
  return () => events.forEach((event) => provider.removeListener?.(event, onChange));
}

/** Adapt a connection to the existing WalletManager-compatible record shape. */
export function toWalletRecord(connection: WalletConnection, id = 'browser-wallet') {
  return {
    id,
    address: connection.address,
    type: connection.chain === 'bitcoin' ? 'bitcoin' as const : 'ethereum' as const,
    label: `${connection.provider} ${connection.network}`,
    percentage: 0,
  };
}

/**
 * Convenient state-light client for UI code:
 *
 * const wallet = createWalletClient();
 * const connection = await wallet.connect('bitcoin');
 */
export class WalletExtensionClient {
  private readonly providers?: WalletExtensionWindow;

  constructor(options: WalletClientOptions = {}) {
    this.providers = options.providers;
  }

  detect() {
    return detectWalletExtensions(this.providers);
  }

  connect(chain: WalletChain) {
    return connectWalletExtension(chain, undefined, this.providers);
  }

  watch(connection: WalletConnection, onChange: (...args: unknown[]) => void) {
    return watchWalletExtension(connection, onChange, this.providers);
  }

  toWalletRecord(connection: WalletConnection, id?: string) {
    return toWalletRecord(connection, id);
  }
}

export function createWalletClient(options?: WalletClientOptions) {
  return new WalletExtensionClient(options);
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
    unisat?: UnisatProvider;
  }
}

export default createWalletClient;
