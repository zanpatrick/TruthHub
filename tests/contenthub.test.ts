import { describe, it, expect, beforeEach } from "vitest";

interface Article {
  author: string;
  ipfsHash: string;
  title: string;
  category: string;
  tags: string[];
  timestamp: bigint;
  published: boolean;
  fundingVaultId: bigint;
}

interface Event {
  eventType: string;
  timestamp: bigint;
  actor: string;
}

interface MockContract {
  admin: string;
  paused: boolean;
  articleCounter: bigint;
  maxTitleLength: bigint;
  maxTags: bigint;
  articles: Map<bigint, Article>;
  articleEvents: Map<bigint, Event[]>;
  isAdmin(caller: string): boolean;
  setPaused(caller: string, pause: boolean): { value: boolean } | { error: number };
  transferAdmin(caller: string, newAdmin: string): { value: boolean } | { error: number };
  setMaxTitleLength(caller: string, newLength: bigint): { value: boolean } | { error: number };
  publishArticle(caller: string, ipfsHash: string, title: string, category: string, tags: string[]): { value: bigint } | { error: number };
  updateArticleMetadata(caller: string, articleId: bigint, ipfsHash: string, title: string, category: string, tags: string[]): { value: boolean } | { error: number };
  setArticlePublished(caller: string, articleId: bigint): { value: boolean } | { error: number };
  getArticle(articleId: bigint): { value: Article } | { error: number };
  getArticleEvents(articleId: bigint): { value: Event[] };
}

const validIpfsHash = (): string => "QmTzQ1NjRSzGM6T1XqEyYz2AKU6W8DL9tHc6vXe97kwE9ea";
const anotherValidIpfsHash = (): string => "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";

const mockContract: MockContract = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  paused: false,
  articleCounter: 0n,
  maxTitleLength: 100n,
  maxTags: 5n,
  articles: new Map<bigint, Article>(),
  articleEvents: new Map<bigint, Event[]>(),

  isAdmin(caller: string): boolean {
    return caller === this.admin;
  },

  setPaused(caller: string, pause: boolean) {
    if (!this.isAdmin(caller)) return { error: 100 };
    this.paused = pause;
    return { value: pause };
  },

  transferAdmin(caller: string, newAdmin: string) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (newAdmin === "SP000000000000000000002Q6VF78") return { error: 106 };
    this.admin = newAdmin;
    return { value: true };
  },

  setMaxTitleLength(caller: string, newLength: bigint) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (newLength <= 0n) return { error: 108 };
    this.maxTitleLength = newLength;
    return { value: true };
  },

  publishArticle(caller, ipfsHash, title, category, tags) {
    if (this.paused) return { error: 107 };
    if (!["news", "opinion", "investigative", "feature", "analysis"].includes(category)) return { error: 105 };
    if (ipfsHash.length !== 46 || ipfsHash.slice(0, 2) !== "Qm") return { error: 101 };
    if (title.length > Number(this.maxTitleLength)) return { error: 108 };
    if (tags.length > Number(this.maxTags)) return { error: 108 };
    const articleId = this.articleCounter + 1n;
    this.articles.set(articleId, {
      author: caller,
      ipfsHash,
      title,
      category,
      tags,
      timestamp: 100n,
      published: true,
      fundingVaultId: articleId
    });
    const events = this.articleEvents.get(articleId) || [];
    events.push({ eventType: "published", timestamp: 100n, actor: caller });
    this.articleEvents.set(articleId, events);
    this.articleCounter = articleId;
    return { value: articleId };
  },

  updateArticleMetadata(caller, articleId, ipfsHash, title, category, tags) {
    if (this.paused) return { error: 107 };
    const article = this.articles.get(articleId);
    if (!article) return { error: 102 };
    if (article.author !== caller) return { error: 100 };
    if (article.published) return { error: 103 };
    if (!["news", "opinion", "investigative", "feature", "analysis"].includes(category)) return { error: 105 };
    if (ipfsHash.length !== 46 || ipfsHash.slice(0, 2) !== "Qm") return { error: 101 };
    if (title.length > Number(this.maxTitleLength)) return { error: 108 };
    if (tags.length > Number(this.maxTags)) return { error: 108 };
    this.articles.set(articleId, { ...article, ipfsHash, title, category, tags, timestamp: 100n });
    const events = this.articleEvents.get(articleId) || [];
    events.push({ eventType: "metadata-updated", timestamp: 100n, actor: caller });
    this.articleEvents.set(articleId, events);
    return { value: true };
  },

  setArticlePublished(caller, articleId) {
    if (this.paused) return { error: 107 };
    const article = this.articles.get(articleId);
    if (!article) return { error: 102 };
    if (article.author !== caller) return { error: 100 };
    if (article.published) return { error: 103 };
    this.articles.set(articleId, { ...article, published: true, timestamp: 100n });
    const events = this.articleEvents.get(articleId) || [];
    events.push({ eventType: "published", timestamp: 100n, actor: caller });
    this.articleEvents.set(articleId, events);
    return { value: true };
  },

  getArticle(articleId) {
    const article = this.articles.get(articleId);
    if (!article) return { error: 102 };
    if (!article.published) return { error: 104 };
    return { value: article };
  },

  getArticleEvents(articleId) {
    return { value: this.articleEvents.get(articleId) || [] };
  }
};

describe("ContentHub Contract", () => {
  beforeEach(() => {
    mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockContract.paused = false;
    mockContract.articleCounter = 0n;
    mockContract.maxTitleLength = 100n;
    mockContract.maxTags = 5n;
    mockContract.articles = new Map();
    mockContract.articleEvents = new Map();
  });

  it("should allow admin to transfer admin rights", () => {
    const result = mockContract.transferAdmin(mockContract.admin, "ST2CY5...");
    expect(result).toEqual({ value: true });
    expect(mockContract.admin).toBe("ST2CY5...");
  });

  it("should prevent non-admin from transferring admin rights", () => {
    const result = mockContract.transferAdmin("ST2CY5...", "ST3NB...");
    expect(result).toEqual({ error: 100 });
  });

  it("should allow admin to pause contract", () => {
    const result = mockContract.setPaused(mockContract.admin, true);
    expect(result).toEqual({ value: true });
    expect(mockContract.paused).toBe(true);
  });

  it("should prevent non-admin from pausing contract", () => {
    const result = mockContract.setPaused("ST2CY5...", true);
    expect(result).toEqual({ error: 100 });
  });

  it("should allow admin to set max title length", () => {
    const result = mockContract.setMaxTitleLength(mockContract.admin, 150n);
    expect(result).toEqual({ value: true });
    expect(mockContract.maxTitleLength).toBe(150n);
  });

  it("should prevent invalid max title length", () => {
    const result = mockContract.setMaxTitleLength(mockContract.admin, 0n);
    expect(result).toEqual({ error: 108 });
  });

  it("should prevent publishing with invalid IPFS hash", () => {
    const result = mockContract.publishArticle(
      "ST2CY5...",
      "InvalidHash",
      "Test Article",
      "news",
      ["tag1"]
    );
    expect(result).toEqual({ error: 101 });
  });

  it("should prevent publishing with invalid category", () => {
    const result = mockContract.publishArticle(
      "ST2CY5...",
      validIpfsHash(),
      "Test Article",
      "invalid",
      ["tag1"]
    );
    expect(result).toEqual({ error: 105 });
  });

  it("should allow author to update unpublished article metadata", () => {
    mockContract.articles.set(1n, {
      author: "ST2CY5...",
      ipfsHash: validIpfsHash(),
      title: "Old Title",
      category: "news",
      tags: ["tag1"],
      timestamp: 100n,
      published: false,
      fundingVaultId: 1n
    });
    const result = mockContract.updateArticleMetadata(
      "ST2CY5...",
      1n,
      anotherValidIpfsHash(),
      "New Title",
      "opinion",
      ["tag2", "tag3"]
    );
    expect(result).toEqual({ value: true });
    const article = mockContract.articles.get(1n);
    expect(article).toEqual({
      author: "ST2CY5...",
      ipfsHash: anotherValidIpfsHash(),
      title: "New Title",
      category: "opinion",
      tags: ["tag2", "tag3"],
      timestamp: 100n,
      published: false,
      fundingVaultId: 1n
    });
  });

  it("should prevent non-author from updating metadata", () => {
    mockContract.articles.set(1n, {
      author: "ST2CY5...",
      ipfsHash: validIpfsHash(),
      title: "Test Article",
      category: "news",
      tags: ["tag1"],
      timestamp: 100n,
      published: false,
      fundingVaultId: 1n
    });
    const result = mockContract.updateArticleMetadata(
      "ST3NB...",
      1n,
      anotherValidIpfsHash(),
      "New Title",
      "opinion",
      ["tag2"]
    );
    expect(result).toEqual({ error: 100 });
  });

  it("should allow author to set article as published", () => {
    mockContract.articles.set(1n, {
      author: "ST2CY5...",
      ipfsHash: validIpfsHash(),
      title: "Test Article",
      category: "news",
      tags: ["tag1"],
      timestamp: 100n,
      published: false,
      fundingVaultId: 1n
    });
    const result = mockContract.setArticlePublished("ST2CY5...", 1n);
    expect(result).toEqual({ value: true });
    expect(mockContract.articles.get(1n)?.published).toBe(true);
  });

  it("should retrieve published article", () => {
    mockContract.articles.set(1n, {
      author: "ST2CY5...",
      ipfsHash: validIpfsHash(),
      title: "Test Article",
      category: "news",
      tags: ["tag1"],
      timestamp: 100n,
      published: true,
      fundingVaultId: 1n
    });
    const result = mockContract.getArticle(1n);
    expect(result).toEqual({
      value: {
        author: "ST2CY5...",
        ipfsHash: validIpfsHash(),
        title: "Test Article",
        category: "news",
        tags: ["tag1"],
        timestamp: 100n,
        published: true,
        fundingVaultId: 1n
      }
    });
  });

  it("should prevent retrieving unpublished article", () => {
    mockContract.articles.set(1n, {
      author: "ST2CY5...",
      ipfsHash: validIpfsHash(),
      title: "Test Article",
      category: "news",
      tags: ["tag1"],
      timestamp: 100n,
      published: false,
      fundingVaultId: 1n
    });
    const result = mockContract.getArticle(1n);
    expect(result).toEqual({ error: 104 });
  });
});
