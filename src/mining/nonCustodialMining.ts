export type MiningNetwork = 'bitcoin-mainnet';

export interface PoolDefinition {
  id: string;
  name: string;
  website: string;
  networks: string[];
  connectionType: 'stratum' | 'provider-api';
  requiresUserWallet: boolean;
  requiresUserAuthorization: boolean;
}

export interface RigSlot {
  id: number;
  enabled: boolean;
  poolId: string | null;
  workerName: string;
  targetHashrateTHs: number;
  observedHashrateTHs: number;
  status: 'unconfigured' | 'ready' | 'awaiting-authorization' | 'connected' | 'offline';
}

export interface NonCustodialMiningState {
  slots: RigSlot[];
  selectedNetwork: MiningNetwork;
  walletAddress?: string;
  availableProfit: number;
  currency: string;
}

export const SUPPORTED_POOLS: readonly PoolDefinition[] = [
  {
    id: 'braiins-pool',
    name: 'Braiins Pool',
    website: 'https://braiins.com/pool',
    networks: ['Bitcoin'],
    connectionType: 'stratum',
    requiresUserWallet: true,
    requiresUserAuthorization: true,
  },
  {
    id: 'btc-com',
    name: 'BTC.com Pool',
    website: 'https://pool.btc.com',
    networks: ['Bitcoin'],
    connectionType: 'stratum',
    requiresUserWallet: true,
    requiresUserAuthorization: true,
  },
  {
    id: 'binance-pool',
    name: 'Binance Pool',
    website: 'https://pool.binance.com',
    networks: ['Bitcoin'],
    connectionType: 'stratum',
    requiresUserWallet: true,
    requiresUserAuthorization: true,
  },
];

export const MAX_RIG_SLOTS = 10;
export const MAX_HASHRATE_TH_S = 10_000_000;

export function clampHashrate(hashrate: number): number {
  if (!Number.isFinite(hashrate)) return 0;
  return Math.min(MAX_HASHRATE_TH_S, Math.max(0, Math.floor(hashrate)));
}

export function createRigSlots(): RigSlot[] {
  return Array.from({ length: MAX_RIG_SLOTS }, (_, index) => ({
    id: index + 1,
    enabled: false,
    poolId: null,
    workerName: `rig-${String(index + 1).padStart(2, '0')}`,
    targetHashrateTHs: 0,
    observedHashrateTHs: 0,
    status: 'unconfigured',
  }));
}

/**
 * Prepare a read-only dashboard state. It does not store keys, submit work,
 * change pool settings, or transfer rewards.
 */
export function createNonCustodialState(overrides: Partial<NonCustodialMiningState> = {}): NonCustodialMiningState {
  return {
    slots: overrides.slots || createRigSlots(),
    selectedNetwork: overrides.selectedNetwork || 'bitcoin-mainnet',
    walletAddress: overrides.walletAddress,
    availableProfit: Math.max(0, overrides.availableProfit || 0),
    currency: overrides.currency || 'USD',
  };
}

/** Collect All is intentionally a review/claim intent, never an automatic transfer. */
export function createClaimReview(state: NonCustodialMiningState) {
  return {
    kind: 'claim-review' as const,
    amount: state.availableProfit,
    currency: state.currency,
    walletAddress: state.walletAddress,
    requiresUserConfirmation: true,
    requiresProviderAuthorization: true,
    custodialTransfer: false,
  };
}
