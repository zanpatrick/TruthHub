import { describe, it, expect, beforeEach } from "vitest";

interface Funds {
  totalAmount: bigint;
  released: boolean;
  releaseBlock: bigint;
}

interface Event {
  eventType: string;
  timestamp: bigint;
  actor: string;
  amount: bigint;
}

interface MockContentHub {
  getArticle(articleId: bigint): { value: { author: string } } | { error: number };
}

interface MockToken {
  transfer(amount: bigint, from: string, to: string, memo: string | null): { value: boolean } | { error: number };
}

interface MockContract {
  admin: string;
  paused: boolean;
  tokenAddress: string;
  lockPeriod: bigint;
  articleFunds: Map<bigint, Funds>;
  contributions: Map<string, bigint>;
  fundingEvents: Map<bigint, Event[]>;
  contentHub: MockContentHub;
  token: MockToken;
  isAdmin(caller: string): boolean;
  setPaused(caller: string, pause: boolean): { value: boolean } | { error: number };
  transferAdmin(caller: string, newAdmin: string): { value: boolean } | { error: number };
  setTokenAddress(caller: string, newToken: string): { value: boolean } | { error: number };
  setLockPeriod(caller: string, newPeriod: bigint): { value: boolean } | { error: number };
  donate(caller: string, articleId: bigint, amount: bigint): { value: boolean } | { error: number };
  releaseFunds(caller: string, articleId: bigint, currentBlock: bigint): { value: boolean } | { error: number };
  getArticleFunds(articleId: bigint): { value: Funds };
  getContribution(articleId: bigint, donor: string): { value: bigint };
  getFundingEvents(articleId: bigint): { value: Event[] };
  getAdmin(): { value: string };
  isPaused(): { value: boolean };
  getTokenAddress(): { value: string };
  getLockPeriod(): { value: bigint };
}

const mockContentHub: MockContentHub = {
  getArticle(articleId: bigint): { value: { author: string } } | { error: number } {
    if (articleId === 1n) return { value: { author: "ST2CY5..." } };
    return { error: 101 };
  }
};

const mockToken: MockToken = {
  transfer(amount: bigint, from: string, to: string, memo: string | null): { value: boolean } | { error: number } {
    if (amount <= 0n) return { error: 102 };
    return { value: true };
  }
};

const mockContract: MockContract = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  paused: false,
  tokenAddress: "SP000000000000000000002Q6VF78",
  lockPeriod: 1440n,
  articleFunds: new Map<bigint, Funds>(),
  contributions: new Map<string, bigint>(),
  fundingEvents: new Map<bigint, Event[]>(),
  contentHub: mockContentHub,
  token: mockToken,

  isAdmin(caller: string): boolean {
    return caller === this.admin;
  },

  setPaused(caller: string, pause: boolean): { value: boolean } | { error: number } {
    if (!this.isAdmin(caller)) return { error: 100 };
    this.paused = pause;
    return { value: pause };
  },

  transferAdmin(caller: string, newAdmin: string): { value: boolean } | { error: number } {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (newAdmin === "SP000000000000000000002Q6VF78") return { error: 103 };
    this.admin = newAdmin;
    return { value: true };
  },

  setTokenAddress(caller: string, newToken: string): { value: boolean } | { error: number } {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (newToken === "SP000000000000000000002Q6VF78") return { error: 103 };
    this.tokenAddress = newToken;
    return { value: true };
  },

  setLockPeriod(caller: string, newPeriod: bigint): { value: boolean } | { error: number } {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (newPeriod <= 0n) return { error: 102 };
    this.lockPeriod = newPeriod;
    return { value: true };
  },

  donate(caller: string, articleId: bigint, amount: bigint): { value: boolean } | { error: number } {
    if (this.paused) return { error: 104 };
    if (this.contentHub.getArticle(articleId).error) return { error: 105 };
    if (amount <= 0n) return { error: 102 };
    const tokenTransfer = this.token.transfer(amount, caller, "contract", null);
    if (tokenTransfer.error) return { error: 107 };
    const currentFunds = this.articleFunds.get(articleId) || { totalAmount: 0n, released: false, releaseBlock: 0n };
    this.articleFunds.set(articleId, {
      totalAmount: currentFunds.totalAmount + amount,
      released: false,
      releaseBlock: BigInt(100) + this.lockPeriod
    });
    const contributionKey = `${articleId}-${caller}`;
    this.contributions.set(contributionKey, (this.contributions.get(contributionKey) || 0n) + amount);
    const events = this.fundingEvents.get(articleId) || [];
    events.push({ eventType: "donation", timestamp: BigInt(100), actor: caller, amount });
    this.fundingEvents.set(articleId, events);
    return { value: true };
  },

  releaseFunds(caller: string, articleId: bigint, currentBlock: bigint): { value: boolean } | { error: number } {
    if (this.paused) return { error: 104 };
    const article = this.contentHub.getArticle(articleId);
    if (article.error) return { error: 101 };
    const funds = this.articleFunds.get(articleId);
    if (!funds) return { error: 101 };
    if (currentBlock < funds.releaseBlock) return { error: 106 };
    if (funds.released) return { error: 106 };
    if (funds.totalAmount <= 0n) return { error: 102 };
    const tokenTransfer = this.token.transfer(funds.totalAmount, "contract", article.value.author, null);
    if (tokenTransfer.error) return { error: 107 };
    this.articleFunds.set(articleId, { ...funds, released: true });
    const events = this.fundingEvents.get(articleId) || [];
    events.push({ eventType: "released", timestamp: BigInt(100), actor: article.value.author, amount: funds.totalAmount });
    this.fundingEvents.set(articleId, events);
    return { value: true };
  },

  getArticleFunds(articleId: bigint): { value: Funds } {
    return { value: this.articleFunds.get(articleId) || { totalAmount: 0n, released: false, releaseBlock: 0n } };
  },

  getContribution(articleId: bigint, donor: string): { value: bigint } {
    return { value: this.contributions.get(`${articleId}-${donor}`) || 0n };
  },

  getFundingEvents(articleId: bigint): { value: Event[] } {
    return { value: this.fundingEvents.get(articleId) || [] };
  },

  getAdmin(): { value: string } {
    return { value: this.admin };
  },

  isPaused(): { value: boolean } {
    return { value: this.paused };
  },

  getTokenAddress(): { value: string } {
    return { value: this.tokenAddress };
  },

  getLockPeriod(): { value: bigint } {
    return { value: this.lockPeriod };
  }
};

describe("FundingVault Contract", () => {
  beforeEach(() => {
    mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockContract.paused = false;
    mockContract.tokenAddress = "SP000000000000000000002Q6VF78";
    mockContract.lockPeriod = 1440n;
    mockContract.articleFunds = new Map();
    mockContract.contributions = new Map();
    mockContract.fundingEvents = new Map();
  });

  it("should allow admin to transfer admin rights", () => {
    const result = mockContract.transferAdmin(mockContract.admin, "ST2CY5...");
    expect(result).toEqual({ value: true });
    expect(mockContract.getAdmin()).toEqual({ value: "ST2CY5..." });
  });

  it("should prevent non-admin from transferring admin rights", () => {
    const result = mockContract.transferAdmin("ST2CY5...", "ST3NB...");
    expect(result).toEqual({ error: 100 });
  });

  it("should allow admin to pause contract", () => {
    const result = mockContract.setPaused(mockContract.admin, true);
    expect(result).toEqual({ value: true });
    expect(mockContract.isPaused()).toEqual({ value: true });
  });

  it("should prevent non-admin from pausing contract", () => {
    const result = mockContract.setPaused("ST2CY5...", true);
    expect(result).toEqual({ error: 100 });
  });

  it("should allow admin to set token address", () => {
    const result = mockContract.setTokenAddress(mockContract.admin, "ST3NB...");
    expect(result).toEqual({ value: true });
    expect(mockContract.getTokenAddress()).toEqual({ value: "ST3NB..." });
  });

  it("should prevent setting invalid token address", () => {
    const result = mockContract.setTokenAddress(mockContract.admin, "SP000000000000000000002Q6VF78");
    expect(result).toEqual({ error: 103 });
  });

  it("should allow admin to set lock period", () => {
    const result = mockContract.setLockPeriod(mockContract.admin, 2880n);
    expect(result).toEqual({ value: true });
    expect(mockContract.getLockPeriod()).toEqual({ value: 2880n });
  });

  it("should prevent setting invalid lock period", () => {
    const result = mockContract.setLockPeriod(mockContract.admin, 0n);
    expect(result).toEqual({ error: 102 });
  });

  it("should allow donation to valid article", () => {
    const result = mockContract.donate("ST3NB...", 1n, 1000n);
    expect(result).toEqual({ value: true });
    const funds = mockContract.getArticleFunds(1n).value;
    expect(funds).toEqual({ totalAmount: 1000n, released: false, releaseBlock: 1540n });
    expect(mockContract.getContribution(1n, "ST3NB...").value).toBe(1000n);
    expect(mockContract.getFundingEvents(1n).value).toEqual([
      { eventType: "donation", timestamp: 100n, actor: "ST3NB...", amount: 1000n }
    ]);
  });

  it("should prevent donation to invalid article", () => {
    const result = mockContract.donate("ST3NB...", 2n, 1000n);
    expect(result).toEqual({ error: 105 });
  });

  it("should prevent donation with zero amount", () => {
    const result = mockContract.donate("ST3NB...", 1n, 0n);
    expect(result).toEqual({ error: 102 });
  });

  it("should prevent donation when paused", () => {
    mockContract.setPaused(mockContract.admin, true);
    const result = mockContract.donate("ST3NB...", 1n, 1000n);
    expect(result).toEqual({ error: 104 });
  });

  it("should allow funds release after lock period", () => {
    mockContract.donate("ST3NB...", 1n, 1000n);
    const result = mockContract.releaseFunds("ST2CY5...", 1n, 1540n);
    expect(result).toEqual({ value: true });
    const funds = mockContract.getArticleFunds(1n).value;
    expect(funds).toEqual({ totalAmount: 1000n, released: true, releaseBlock: 1540n });
    expect(mockContract.getFundingEvents(1n).value).toContainEqual({
      eventType: "released",
      timestamp: 100n,
      actor: "ST2CY5...",
      amount: 1000n
    });
  });

  it("should prevent funds release before lock period", () => {
    mockContract.donate("ST3NB...", 1n, 1000n);
    const result = mockContract.releaseFunds("ST2CY5...", 1n, 100n);
    expect(result).toEqual({ error: 106 });
  });

  it("should prevent funds release for invalid article", () => {
    const result = mockContract.releaseFunds("ST2CY5...", 2n, 1540n);
    expect(result).toEqual({ error: 101 });
  });

  it("should prevent funds release if already released", () => {
    mockContract.donate("ST3NB...", 1n, 1000n);
    mockContract.releaseFunds("ST2CY5...", 1n, 1540n);
    const result = mockContract.releaseFunds("ST2CY5...", 1n, 1540n);
    expect(result).toEqual({ error: 106 });
  });

  it("should return zero funds for non-existent article", () => {
    const result = mockContract.getArticleFunds(999n);
    expect(result).toEqual({ value: { totalAmount: 0n, released: false, releaseBlock: 0n } });
  });

  it("should return zero contribution for non-existent donor", () => {
    const result = mockContract.getContribution(1n, "ST4XYZ...");
    expect(result).toEqual({ value: 0n });
  });

  it("should return empty events for non-existent article", () => {
    const result = mockContract.getFundingEvents(999n);
    expect(result).toEqual({ value: [] });
  });
});