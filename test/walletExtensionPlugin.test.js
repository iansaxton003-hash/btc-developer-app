const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createWalletClient,
  WalletExtensionError,
  toWalletRecord,
} = require('../dist');

test('connects to an injected EVM provider', async () => {
  const calls = [];
  const providers = {
    ethereum: {
      request: async ({ method }) => {
        calls.push(method);
        if (method === 'eth_requestAccounts') return ['0xabc'];
        if (method === 'eth_chainId') return '0x1';
        throw new Error(`unexpected method ${method}`);
      },
    },
  };
  const wallet = createWalletClient({ providers });
  assert.deepEqual(wallet.detect(), { evm: true, bitcoin: false });
  const connection = await wallet.connect('evm');
  assert.equal(connection.address, '0xabc');
  assert.equal(connection.network, '0x1');
  assert.deepEqual(calls, ['eth_requestAccounts', 'eth_chainId']);
});

test('connects to an injected Bitcoin provider', async () => {
  const wallet = createWalletClient({
    providers: {
      unisat: {
        requestAccounts: async () => ['bc1qexample'],
        getNetwork: async () => 'livenet',
      },
    },
  });
  const connection = await wallet.connect('bitcoin');
  assert.equal(connection.address, 'bc1qexample');
  assert.equal(connection.network, 'livenet');
  assert.equal(toWalletRecord(connection).type, 'bitcoin');
});

test('returns an actionable error when no provider is installed', async () => {
  const wallet = createWalletClient({ providers: {} });
  await assert.rejects(() => wallet.connect('bitcoin'), WalletExtensionError);
  await assert.rejects(() => wallet.connect('evm'), /EIP-1193/);
});
