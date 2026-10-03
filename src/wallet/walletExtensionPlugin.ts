/**
 * Plug-and-play browser wallet extension adapter.
 *
 * This package reads public wallet identity only. It never requests or stores
 * seed phrases, private keys, API keys, or transaction-signing authority.
 */

export type BuiltInWalletChain = 'evm' | 'bitcoin' | 'solana';
export type WalletChain = BuiltInWalletChain | (string & {});

export interface WalletConnection {
  provider: 'eip1193' | 'unisat' | 'solana' | 'custom';
  chain: WalletChain;
  address: string;
  network: string;
  /** Present for custom adapters so the caller can identify the adapter. */
  adapterId?: string;
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

/** Common Phantom-style Solana injected provider shape. */
export interface SolanaProvider {
  connect(): Promise<{ publicKey?: unknown } | void>;
  publicKey?: unknown;
  network?: string;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

/** Adapter contract for any other non-EVM wallet extension. */
export interface CustomWalletAdapter {
  /** Stable identifier, e.g. 'cardano', 'polkadot', or 'cosmos'. */
  id: string;
  /** Chain name returned in WalletConnection. */
  chain: string;
  connect(): Promise<{ address: string; network?: string }>;
  on?: (event: 'accountChanged' | 'networkChanged', handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: 'accountChanged' | 'networkChanged', handler: (...args: unknown[]) => void) => void;
}

export interface WalletExtensionWindow {
  ethereum?: Eip1193Provider;
  unisat?: UnisatProvider;
  solana?: SolanaProvider;
}

export interface WalletClientOptions {
  /** Optional injected providers, useful for SSR, testing, and custom bridges. */
  providers?: WalletExtensionWindow;
  /** Optional non-EVM adapters supplied by the application. */
  adapters?: CustomWalletAdapter[];
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

function publicKeyToAddress(publicKey: unknown): string {
  if (typeof publicKey === 'string') return publicKey;
  if (publicKey && typeof (publicKey as { toString?: unknown }).toString === 'function') {
    const value = String((publicKey as { toString(): string }).toString());
    if (value && value !== '[object Object]') return value;
  }
  throw new WalletExtensionError('The wallet returned no public address.');
}

/** Detect installed providers without triggering a wallet permission prompt. */
export function detectWalletExtensions(
  providers?: WalletExtensionWindow,
  adapters: CustomWalletAdapter[] = []
): { evm: boolean; bitcoin: boolean; solana: boolean; [adapterId: string]: boolean } {
  const current = resolveProviders(providers);
  const detected: { evm: boolean; bitcoin: boolean; solana: boolean; [adapterId: string]: boolean } = {
    evm: Boolean(current.ethereum),
    bitcoin: Boolean(current.unisat),
    solana: Boolean(current.solana),
  };
  for (const adapter of adapters) detected[adapter.id] = true;
  return detected;
}

/**
 * Connect to an installed wallet extension and return public identity data.
 * Supports EVM, Bitcoin/UniSat, Solana/Phantom-style providers, and custom
 * adapters for other non-EVM ecosystems.
 */
export async function connectWalletExtension(
  chain: WalletChain,
  preferredProvider?: Eip1193Provider | UnisatProvider | SolanaProvider,
  providers?: WalletExtensionWindow,
  adapters: CustomWalletAdapter[] = []
): Promise<WalletConnection> {
  const current = resolveProviders(providers);

  if (chain === 'bitcoin') {
    const provider = (preferredProvider || current.unisat) as UnisatProvider | undefined;
    if (!provider?.requestAccounts || !provider.getNetwork) {
      throw new WalletExtensionError('No UniSat-compatible Bitcoin wallet extension was detected.');
    }
    const accounts = await provider.requestAccounts();
    const address = accounts[0];
    if (!address) throw new WalletExtensionError('The wallet returned no Bitcoin address.');
    return { provider: 'unisat', chain, address, network: await provider.getNetwork() };
  }

  if (chain === 'solana') {
    const provider = (preferredProvider || current.solana) as SolanaProvider | undefined;
    if (!provider?.connect) {
      throw new WalletExtensionError('No Solana-compatible wallet extension was detected.');
    }
    const result = await provider.connect();
    const address = publicKeyToAddress(result?.publicKey || provider.publicKey);
    return { provider: 'solana', chain, address, network: provider.network || 'mainnet-beta' };
  }

  if (chain !== 'evm') {
    const adapter = adapters.find((candidate) => candidate.id === chain || candidate.chain === chain);
    if (!adapter) throw new WalletExtensionError(`No adapter registered for ${chain}.`);
    const result = await adapter.connect();
    if (!result.address) throw new WalletExtensionError(`The ${chain} adapter returned no address.`);
    return {
      provider: 'custom',
      chain: adapter.chain,
      adapterId: adapter.id,
      address: result.address,
      network: result.network || 'unknown',
    };
  }

  const provider = (preferredProvider || current.ethereum) as Eip1193Provider | undefined;
  if (!provider?.request) throw new WalletExtensionError('No EIP-1193 wallet extension was detected.');
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
  providers?: WalletExtensionWindow,
  adapters: CustomWalletAdapter[] = []
): () => void {
  const current = resolveProviders(providers);
  const provider = connection.provider === 'unisat'
    ? current.unisat
    : connection.provider === 'solana'
      ? current.solana
      : connection.provider === 'eip1193'
        ? current.ethereum
        : adapters.find((adapter) => adapter.id === connection.adapterId);
  if (!provider?.on) return () => undefined;

  const events = connection.provider === 'unisat' || connection.provider === 'eip1193'
    ? ['accountsChanged', 'chainChanged']
    : connection.provider === 'solana'
      ? ['accountChanged']
      : ['accountChanged', 'networkChanged'];
  const on = provider.on as unknown as ((event: string, handler: (...args: unknown[]) => void) => void) | undefined;
  const remove = provider.removeListener as unknown as ((event: string, handler: (...args: unknown[]) => void) => void) | undefined;
  events.forEach((event) => on?.(event, onChange));
  return () => events.forEach((event) => remove?.(event, onChange));
}

/** Adapt a connection to a simple wallet record shape. */
export function toWalletRecord(connection: WalletConnection, id = 'browser-wallet') {
  return {
    id,
    address: connection.address,
    type: connection.chain,
    label: `${connection.provider} ${connection.network}`,
    percentage: 0,
  };
}

export class WalletExtensionClient {
  private readonly providers?: WalletExtensionWindow;
  private readonly adapters: CustomWalletAdapter[];

  constructor(options: WalletClientOptions = {}) {
    this.providers = options.providers;
    this.adapters = options.adapters || [];
  }

  detect() {
    return detectWalletExtensions(this.providers, this.adapters);
  }

  connect(chain: WalletChain) {
    return connectWalletExtension(chain, undefined, this.providers, this.adapters);
  }

  watch(connection: WalletConnection, onChange: (...args: unknown[]) => void) {
    return watchWalletExtension(connection, onChange, this.providers, this.adapters);
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
    solana?: SolanaProvider;
  }
}

export default createWalletClient;
