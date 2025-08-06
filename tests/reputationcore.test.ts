import { describe, it, expect, beforeEach } from "vitest";

interface Reputation {
  score: bigint;
  articleCount: bigint; // Made required
  factCheckCount: bigint; // Made required
}

interface FactCheck {
  score: bigint;
  timestamp: bigint;
}

interface Feedback {
  score: bigint;
  timestamp: bigint;
}

interface Event {
  eventType: string;
  timestamp: bigint;
  actor: string;
  articleId: bigint;
  score: bigint;
}

interface MockContentHub {
  getArticle(articleId: bigint): { value: { author: string } } | { error: number };
}

interface MockContract {
  admin: string;
  paused: boolean;
  factCheckWeight: bigint;
  feedbackWeight: bigint;
  journalistReputation: Map<string, Reputation>;
  readerReputation: Map<string, Reputation>;
  factChecks: Map<string, FactCheck>;
  feedback: Map<string, Feedback>;
  reputationEvents: Map<string, Event[]>;
  contentHub: MockContentHub;
  isAdmin(caller: string): boolean;
  setPaused(caller: string, pause: boolean): { value: boolean } | { error: number };
  transferAdmin(caller: string, newAdmin: string): { value: boolean } | { error: number };
  setFactCheckWeight(caller: string, newWeight: bigint): { value: boolean } | { error: number };
  setFeedbackWeight(caller: string, newWeight: bigint): { value: boolean } | { error: number };
  submitFactCheck(caller: string, articleId: bigint, score: bigint): { value: boolean } | { error: number };
  submitFeedback(caller: string, articleId: bigint, score: bigint): { value: boolean } | { error: number };
  getJournalistReputation(journalist: string): { value: Reputation };
  getReaderReputation(reader: string): { value: Reputation };
  getFactCheck(articleId: bigint, checker: string): { value: FactCheck | undefined };
  getFeedback(articleId: bigint, reviewer: string): { value: Feedback | undefined };
  getReputationEvents(journalist: string): { value: Event[] };
  getAdmin(): { value: string };
  isPaused(): { value: boolean };
  getFactCheckWeight(): { value: bigint };
  getFeedbackWeight(): { value: bigint };
}

const mockContentHub: MockContentHub = {
  getArticle(articleId: bigint): { value: { author: string } } | { error: number } {
    if (articleId === 1n) return { value: { author: "ST2CY5..." } };
    return { error: 101 };
  }
};

const mockContract: MockContract = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  paused: false,
  factCheckWeight: 10n,
  feedbackWeight: 5n,
  journalistReputation: new Map<string, Reputation>(),
  readerReputation: new Map<string, Reputation>(),
  factChecks: new Map<string, FactCheck>(),
  feedback: new Map<string, Feedback>(),
  reputationEvents: new Map<string, Event[]>(),
  contentHub: mockContentHub,

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

  setFactCheckWeight(caller: string, newWeight: bigint): { value: boolean } | { error: number } {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (newWeight <= 0n) return { error: 106 };
    this.factCheckWeight = newWeight;
    return { value: true };
  },

  setFeedbackWeight(caller: string, newWeight: bigint): { value: boolean } | { error: number } {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (newWeight <= 0n) return { error: 106 };
    this.feedbackWeight = newWeight;
    return { value: true };
  },

  submitFactCheck(caller: string, articleId: bigint, score: bigint): { value: boolean } | { error: number } {
    if (this.paused) return { error: 104 };
    const articleResult = this.contentHub.getArticle(articleId);
    if ('error' in articleResult) return { error: 101 };
    if (score < 0n || score > 100n) return { error: 105 };
    const factCheckKey = `${articleId}-${caller}`;
    if (this.factChecks.has(factCheckKey)) return { error: 102 };
    const journalist = articleResult.value.author;
    const currentJournalistRep = this.journalistReputation.get(journalist) || { score: 0n, articleCount: 0n, factCheckCount: 0n };
    const currentReaderRep = this.readerReputation.get(caller) || { score: 0n, articleCount: 0n, factCheckCount: 0n };
    this.factChecks.set(factCheckKey, { score, timestamp: 100n });
    this.journalistReputation.set(journalist, {
      score: currentJournalistRep.score + score,
      articleCount: currentJournalistRep.articleCount + 1n,
      factCheckCount: currentJournalistRep.factCheckCount
    });
    this.readerReputation.set(caller, {
      score: currentReaderRep.score + this.factCheckWeight,
      factCheckCount: currentReaderRep.factCheckCount + 1n,
      articleCount: currentReaderRep.articleCount
    });
    const events = this.reputationEvents.get(journalist) || [];
    events.push({ eventType: "fact-check", timestamp: 100n, actor: caller, articleId, score });
    this.reputationEvents.set(journalist, events);
    return { value: true };
  },

  submitFeedback(caller: string, articleId: bigint, score: bigint): { value: boolean } | { error: number } {
    if (this.paused) return { error: 104 };
    const articleResult = this.contentHub.getArticle(articleId);
    if ('error' in articleResult) return { error: 101 };
    if (score < 0n || score > 100n) return { error: 105 };
    const feedbackKey = `${articleId}-${caller}`;
    const journalist = articleResult.value.author;
    const currentJournalistRep = this.journalistReputation.get(journalist) || { score: 0n, articleCount: 0n, factCheckCount: 0n };
    this.feedback.set(feedbackKey, { score, timestamp: 100n });
    this.journalistReputation.set(journalist, {
      score: currentJournalistRep.score + score,
      articleCount: currentJournalistRep.articleCount + 1n,
      factCheckCount: currentJournalistRep.factCheckCount
    });
    const events = this.reputationEvents.get(journalist) || [];
    events.push({ eventType: "feedback", timestamp: 100n, actor: caller, articleId, score });
    this.reputationEvents.set(journalist, events);
    return { value: true };
  },

  getJournalistReputation(journalist: string): { value: Reputation } {
    return { value: this.journalistReputation.get(journalist) || { score: 0n, articleCount: 0n, factCheckCount: 0n } };
  },

  getReaderReputation(reader: string): { value: Reputation } {
    return { value: this.readerReputation.get(reader) || { score: 0n, articleCount: 0n, factCheckCount: 0n } };
  },

  getFactCheck(articleId: bigint, checker: string): { value: FactCheck | undefined } {
    return { value: this.factChecks.get(`${articleId}-${checker}`) };
  },

  getFeedback(articleId: bigint, reviewer: string): { value: Feedback | undefined } {
    return { value: this.feedback.get(`${articleId}-${reviewer}`) };
  },

  getReputationEvents(journalist: string): { value: Event[] } {
    return { value: this.reputationEvents.get(journalist) || [] };
  },

  getAdmin(): { value: string } {
    return { value: this.admin };
  },

  isPaused(): { value: boolean } {
    return { value: this.paused };
  },

  getFactCheckWeight(): { value: bigint } {
    return { value: this.factCheckWeight };
  },

  getFeedbackWeight(): { value: bigint } {
    return { value: this.feedbackWeight };
  }
};

describe("ReputationCore Contract", () => {
  beforeEach(() => {
    mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockContract.paused = false;
    mockContract.factCheckWeight = 10n;
    mockContract.feedbackWeight = 5n;
    mockContract.journalistReputation = new Map();
    mockContract.readerReputation = new Map();
    mockContract.factChecks = new Map();
    mockContract.feedback = new Map();
    mockContract.reputationEvents = new Map();
  });

  it("should allow admin to transfer admin rights", () => {
    const result = mockContract.transferAdmin(mockContract.admin, "ST3NB...");
    expect(result).toEqual({ value: true });
    expect(mockContract.getAdmin()).toEqual({ value: "ST3NB..." });
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

  it("should allow admin to set fact-check weight", () => {
    const result = mockContract.setFactCheckWeight(mockContract.admin, 20n);
    expect(result).toEqual({ value: true });
    expect(mockContract.getFactCheckWeight()).toEqual({ value: 20n });
  });

  it("should prevent invalid fact-check weight", () => {
    const result = mockContract.setFactCheckWeight(mockContract.admin, 0n);
    expect(result).toEqual({ error: 106 });
  });

  it("should allow admin to set feedback weight", () => {
    const result = mockContract.setFeedbackWeight(mockContract.admin, 15n);
    expect(result).toEqual({ value: true });
    expect(mockContract.getFeedbackWeight()).toEqual({ value: 15n });
  });

  it("should prevent invalid feedback weight", () => {
    const result = mockContract.setFeedbackWeight(mockContract.admin, 0n);
    expect(result).toEqual({ error: 106 });
  });

  it("should allow fact-check submission for valid article", () => {
    const result = mockContract.submitFactCheck("ST3NB...", 1n, 80n);
    expect(result).toEqual({ value: true });
    expect(mockContract.getJournalistReputation("ST2CY5...").value).toEqual({ score: 80n, articleCount: 1n, factCheckCount: 0n });
    expect(mockContract.getReaderReputation("ST3NB...").value).toEqual({ score: 10n, factCheckCount: 1n, articleCount: 0n });
    expect(mockContract.getFactCheck(1n, "ST3NB...").value).toEqual({ score: 80n, timestamp: 100n });
    expect(mockContract.getReputationEvents("ST2CY5...").value).toEqual([
      { eventType: "fact-check", timestamp: 100n, actor: "ST3NB...", articleId: 1n, score: 80n }
    ]);
  });

  it("should prevent fact-check for invalid article", () => {
    const result = mockContract.submitFactCheck("ST3NB...", 2n, 80n);
    expect(result).toEqual({ error: 101 });
  });

  it("should prevent fact-check with invalid score", () => {
    const result = mockContract.submitFactCheck("ST3NB...", 1n, 101n);
    expect(result).toEqual({ error: 105 });
  });

  it("should prevent duplicate fact-check", () => {
    mockContract.submitFactCheck("ST3NB...", 1n, 80n);
    const result = mockContract.submitFactCheck("ST3NB...", 1n, 90n);
    expect(result).toEqual({ error: 102 });
  });

  it("should allow feedback submission for valid article", () => {
    const result = mockContract.submitFeedback("ST3NB...", 1n, 90n);
    expect(result).toEqual({ value: true });
    expect(mockContract.getJournalistReputation("ST2CY5...").value).toEqual({ score: 90n, articleCount: 1n, factCheckCount: 0n });
    expect(mockContract.getFeedback(1n, "ST3NB...").value).toEqual({ score: 90n, timestamp: 100n });
    expect(mockContract.getReputationEvents("ST2CY5...").value).toEqual([
      { eventType: "feedback", timestamp: 100n, actor: "ST3NB...", articleId: 1n, score: 90n }
    ]);
  });

  it("should prevent feedback for invalid article", () => {
    const result = mockContract.submitFeedback("ST3NB...", 2n, 90n);
    expect(result).toEqual({ error: 101 });
  });

  it("should prevent feedback with invalid score", () => {
    const result = mockContract.submitFeedback("ST3NB...", 1n, 101n);
    expect(result).toEqual({ error: 105 });
  });

  it("should return zero reputation for non-existent journalist", () => {
    const result = mockContract.getJournalistReputation("ST4XYZ...");
    expect(result).toEqual({ value: { score: 0n, articleCount: 0n, factCheckCount: 0n } });
  });

  it("should return zero reputation for non-existent reader", () => {
    const result = mockContract.getReaderReputation("ST4XYZ...");
    expect(result).toEqual({ value: { score: 0n, articleCount: 0n, factCheckCount: 0n } });
  });

  it("should return undefined for non-existent fact-check", () => {
    const result = mockContract.getFactCheck(1n, "ST4XYZ...");
    expect(result).toEqual({ value: undefined });
  });

  it("should return undefined for non-existent feedback", () => {
    const result = mockContract.getFeedback(1n, "ST4XYZ...");
    expect(result).toEqual({ value: undefined });
  });

  it("should return empty events for non-existent journalist", () => {
    const result = mockContract.getReputationEvents("ST4XYZ...");
    expect(result).toEqual({ value: [] });
  });
});