import axios from 'axios';

interface CryptoWallet {
  id: string;
  address: string;
  type: 'bitcoin' | 'ethereum' | 'litecoin' | 'dogecoin';
  label: string;
  percentage: number; // allocation percentage
  apiKey?: string;
}

interface CashoutTransaction {
  id: string;
  timestamp: Date;
  amount: number;
  wallets: CashoutAllocation[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  txHash?: string;
}

interface CashoutAllocation {
  walletId: string;
  address: string;
  amount: number;
  percentage: number;
  status: 'pending' | 'sent' | 'confirmed' | 'failed';
}

class WalletManager {
  private wallets: Map<string, CryptoWallet> = new Map();
  private transactions: CashoutTransaction[] = [];

  /**
   * Add a new cryptocurrency wallet for profit distribution
   */
  addWallet(wallet: CryptoWallet): boolean {
    if (this.wallets.has(wallet.id)) {
      console.error(`Wallet ${wallet.id} already exists`);
      return false;
    }

    // Validate percentage allocation
    const totalPercentage = this.getTotalWalletPercentage() + wallet.percentage;
    if (totalPercentage > 100) {
      console.error(`Total wallet percentage would exceed 100% (current: ${totalPercentage}%)`);
      return false;
    }

    this.wallets.set(wallet.id, wallet);
    return true;
  }

  /**
   * Remove a wallet from the distribution pool
   */
  removeWallet(walletId: string): boolean {
    return this.wallets.delete(walletId);
  }

  /**
   * Update wallet allocation percentage
   */
  updateWalletPercentage(walletId: string, percentage: number): boolean {
    const wallet = this.wallets.get(walletId);
    if (!wallet) return false;

    const otherPercentage = this.getTotalWalletPercentage() - wallet.percentage;
    if (otherPercentage + percentage > 100) {
      console.error(`Wallet percentage update would exceed 100%`);
      return false;
    }

    wallet.percentage = percentage;
    return true;
  }

  /**
   * Get total wallet percentage allocation
   */
  private getTotalWalletPercentage(): number {
    return Array.from(this.wallets.values()).reduce(
      (sum, wallet) => sum + wallet.percentage,
      0
    );
  }

  /**
   * Calculate profit distribution across wallets
   */
  private calculateDistribution(
    totalProfit: number
  ): CashoutAllocation[] {
    const allocations: CashoutAllocation[] = [];

    this.wallets.forEach((wallet) => {
      const amount = (totalProfit * wallet.percentage) / 100;
      allocations.push({
        walletId: wallet.id,
        address: wallet.address,
        amount: parseFloat(amount.toFixed(8)),
        percentage: wallet.percentage,
        status: 'pending',
      });
    });

    return allocations;
  }

  /**
   * Execute profit cashout to all configured wallets
   */
  async executeCashout(
    totalProfit: number,
    sourceAddress: string
  ): Promise<CashoutTransaction> {
    if (this.wallets.size === 0) {
      throw new Error('No wallets configured for cashout');
    }

    if (this.getTotalWalletPercentage() !== 100) {
      throw new Error(
        `Wallet percentages must total 100% (current: ${this.getTotalWalletPercentage()}%)`
      );
    }

    const transaction: CashoutTransaction = {
      id: this.generateTransactionId(),
      timestamp: new Date(),
      amount: totalProfit,
      wallets: this.calculateDistribution(totalProfit),
      status: 'processing',
    };

    this.transactions.push(transaction);

    // Process each wallet transfer
    for (const allocation of transaction.wallets) {
      try {
        const result = await this.sendToWallet(allocation, sourceAddress);
        allocation.status = 'sent';
        allocation.status = 'confirmed'; // After confirmation
      } catch (error) {
        console.error(
          `Failed to send ${allocation.amount} to wallet ${allocation.walletId}:`,
          error
        );
        allocation.status = 'failed';
        transaction.status = 'failed';
      }
    }

    transaction.status =
      transaction.wallets.some((w) => w.status === 'failed') &&
      transaction.wallets.every((w) => w.status !== 'confirmed')
        ? 'failed'
        : 'completed';

    return transaction;
  }

  /**
   * Send funds to a specific wallet
   */
  private async sendToWallet(
    allocation: CashoutAllocation,
    sourceAddress: string
  ): Promise<string> {
    // This would integrate with actual blockchain APIs (BlockChain.com, Etherscan, etc.)
    console.log(
      `Sending ${allocation.amount} to ${allocation.address} (${allocation.walletId})`
    );

    // Placeholder for actual transaction sending
    // In production, this would call blockchain-specific APIs
    return this.simulateTransaction(allocation);
  }

  /**
   * Simulate transaction for development/testing
   */
  private async simulateTransaction(allocation: CashoutAllocation): Promise<string> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const txHash = `0x${Math.random().toString(16).substr(2)}`;
        resolve(txHash);
      }, 1000);
    });
  }

  /**
   * Get wallet list
   */
  getWallets(): CryptoWallet[] {
    return Array.from(this.wallets.values());
  }

  /**
   * Get transaction history
   */
  getTransactionHistory(limit: number = 50): CashoutTransaction[] {
    return this.transactions.slice(-limit);
  }

  /**
   * Get transaction by ID
   */
  getTransaction(transactionId: string): CashoutTransaction | undefined {
    return this.transactions.find((t) => t.id === transactionId);
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get wallet profit summary
   */
  getProfitSummary(): {
    wallet: CryptoWallet;
    totalReceived: number;
  }[] {
    const summary = Array.from(this.wallets.values()).map((wallet) => {
      const totalReceived = this.transactions
        .filter((t) => t.status === 'completed')
        .flatMap((t) => t.wallets)
        .filter((a) => a.walletId === wallet.id && a.status === 'confirmed')
        .reduce((sum, a) => sum + a.amount, 0);

      return {
        wallet,
        totalReceived,
      };
    });

    return summary;
  }
}

export { WalletManager, CryptoWallet, CashoutTransaction, CashoutAllocation };
export default new WalletManager();
