# TruthHub

A blockchain-powered journalism platform that empowers independent journalists to publish content, receive transparent funding, and build trust through community-driven fact-checking and reputation systems—all on-chain.

---

## Overview

TruthHub consists of three main smart contracts that form a decentralized, transparent, and rewarding ecosystem for journalists and readers, built on the Stacks blockchain using Clarity:

1. **ContentHub Contract** – Manages article submission, storage, and retrieval with IPFS integration.
2. **FundingVault Contract** – Handles tokenized donations and subscriptions for journalists.
3. **ReputationCore Contract** – Tracks credibility for journalists and readers based on content quality and fact-checking.

---

## Features

- **Decentralized Article Publishing**: Journalists publish articles linked to IPFS for censorship-resistant storage.
- **Transparent Funding**: Readers donate to articles using a platform token, with all transactions tracked on-chain.
- **Reputation System**: Rewards journalists for quality content and readers for fact-checking contributions.
- **Community Trust**: Immutable article records and fact-checking combat misinformation.
- **Scalable Monetization**: Tokenized donations enable direct support for journalists without intermediaries.

---

## Smart Contracts

### ContentHub Contract
- Submit articles with metadata (author, timestamp, IPFS hash).
- Retrieve articles by ID for reader access.
- Track article status (published or draft).
- Emit events for publication transparency.

### FundingVault Contract
- Facilitate reader donations to articles using a platform token.
- Track contributions per article and donor.
- Release funds to journalists based on predefined conditions.
- Record donation events for transparency.

### ReputationCore Contract
- Assign reputation scores to journalists based on community feedback.
- Reward readers with reputation points for fact-checking contributions.
- Prevent duplicate fact-checking by the same user for an article.
- Emit events for reputation updates to maintain trust.

---

## Installation

1. Install [Clarinet CLI](https://docs.hiro.so/clarinet/getting-started).
2. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/truthhub.git
   ```
3. Run tests:
   ```bash
   npm test
   ```
4. Deploy contracts:
   ```bash
   clarinet deploy
   ```

---

## Usage

Each smart contract operates independently but integrates with others for a complete journalism platform experience. Refer to individual contract documentation for function calls, parameters, and usage examples.

---

## License

MIT License