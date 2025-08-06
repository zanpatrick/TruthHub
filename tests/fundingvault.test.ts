import { describe, it, expect, beforeEach } from "vitest";

type Result<T> = { value: T } | { error: number };

interface FundingVault {
  balances: Map<string, bigint>;
  authors: Map<bigint, string>;

  deposit(authorId: bigint, amount: bigint, sender: string): Result<boolean>;
  withdraw(authorId: bigint, amount: bigint, sender: string): Result<boolean>;
  getAuthor(authorId: bigint): Result<{ author: string }>;
  getBalance(sender: string): Result<bigint>;
}

// Mock contract logic
function createMockVault(): FundingVault {
  return {
    balances: new Map(),
    authors: new Map(),

    deposit(authorId, amount, sender) {
      if (!this.authors.has(authorId)) {
        return { error: 404 }; // Author not found
      }
      const balance = this.balances.get(sender) || 0n;
      this.balances.set(sender, balance + amount);
      return { value: true };
    },

    withdraw(authorId, amount, sender) {
      if (!this.authors.has(authorId)) {
        return { error: 404 };
      }
      const balance = this.balances.get(sender) || 0n;
      if (balance < amount) {
        return { error: 403 }; // Insufficient funds
      }
      this.balances.set(sender, balance - amount);
      return { value: true };
    },

    getAuthor(authorId) {
      const author = this.authors.get(authorId);
      return author ? { value: { author } } : { error: 404 };
    },

    getBalance(sender) {
      const balance = this.balances.get(sender);
      return balance !== undefined ? { value: balance } : { error: 404 };
    },
  };
}

describe("FundingVault Contract", () => {
  let vault: FundingVault;
  const authorId = 1n;
  const sender = "ST1ABC123AUTHOR";

  beforeEach(() => {
    vault = createMockVault();
    vault.authors.set(authorId, sender);
  });

  it("allows deposit to author balance", () => {
    const result = vault.deposit(authorId, 100n, sender);
    expect("value" in result && result.value).toBe(true);

    const balance = vault.getBalance(sender);
    expect("value" in balance && balance.value).toBe(100n);
  });

  it("prevents deposit to unknown author", () => {
    const result = vault.deposit(999n, 50n, sender);
    expect("error" in result && result.error).toBe(404);
  });

  it("allows withdrawal with sufficient funds", () => {
    vault.deposit(authorId, 200n, sender);
    const result = vault.withdraw(authorId, 150n, sender);
    expect("value" in result && result.value).toBe(true);

    const balance = vault.getBalance(sender);
    expect("value" in balance && balance.value).toBe(50n);
  });

  it("prevents withdrawal with insufficient funds", () => {
    vault.deposit(authorId, 100n, sender);
    const result = vault.withdraw(authorId, 200n, sender);
    expect("error" in result && result.error).toBe(403);
  });

  it("prevents withdrawal from unknown author", () => {
    const result = vault.withdraw(999n, 50n, sender);
    expect("error" in result && result.error).toBe(404);
  });

  it("retrieves an existing author", () => {
    const result = vault.getAuthor(authorId);
    expect("value" in result && result.value.author).toBe(sender);
  });

  it("returns error for unknown author", () => {
    const result = vault.getAuthor(999n);
    expect("error" in result && result.error).toBe(404);
  });

  it("returns error for balance query of unknown user", () => {
    const result = vault.getBalance("ST1UNKNOWN");
    expect("error" in result && result.error).toBe(404);
  });
});

