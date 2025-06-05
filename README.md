Neon EVM x Raydium Token Launchpad

Overview
This project is a hybrid launchpad that leverages the EVM compatibility of Neon on Solana to collect funds using a bonding curve model and subsequently transfers liquidity to Raydium (a Solana-based AMM/DEX). The launchpad is designed to allow users to participate in token launches with dynamic pricing, ensuring fair allocation and instant post-launch liquidity.

Deployment Transaction: https://neon-devnet.blockscout.com/tx/0x476e039ce52a765d36545732d5d45c74349ed9aa2640cba7ce5bd8beceebcc8d
Contract Address: https://neon-devnet.blockscout.com/address/0x73028149ccC43b5781faE7f1E1da6D03572673ec


🔁 Lifecycle Overview
Funding via Bonding Curve on Neon EVM
Users buy tokens during the funding phase. Token price increases with demand based on a bonding curve.

Liquidity Creation on Solana/Raydium
After sale completion, collected USDT and minted tokens are bridged and liquidity is created on Raydium.

LP Token Handling
LP tokens can be locked in a contract, sent to a DAO, or distributed proportionally to contributors.

⚙️ Components
1. RasieFunding.sol
Main funding contract that:

Accepts USDT.

Mints ERC20 tokens dynamically based on a bonding curve.

Handles logic for forwarding funds and tokens to Raydium.

2. LaunchERC20.sol
Factory contract to:

Deploy a new ERC20 token per project.

Set parameters such as name, symbol, and max supply.

3. solanaInteraction.sol (via composability libraries)
Calls Solana programs to:

Bridge assets.

Create Raydium liquidity pools.

Sync liquidity metadata.


Bonding Curve Logic
We use a linear bonding curve:
```ini
price = basePrice + slope * totalMinted
```

basePrice = Initial price per token (e.g., 1.0 USDT)

slope = Increase in price per token minted (e.g., 0.001 USDT/token)

totalMinted = Tokens minted so far

```ini
cost = n * basePrice + slope * (n * x + n(n-1)/2)
```

Benefits
 Composability Across Chains
Use familiar Solidity tools on Neon EVM.

Tap into deep liquidity on Raydium after sale ends.

Better Token Economics
Bonding curve enables price discovery.

Contributors gain exposure to token + future LP rewards.

 Instant Liquidity
Once the cap is reached or sale ends, liquidity is atomically created on Raydium.

Solves the typical post-IDO “no liquidity” issue.

Fully Onchain & Non-Custodial
Contracts handle token issuance, pricing, funds collection, and liquidity creation.

No human intervention is required post-deployment.


Sample Simulation
Let's walk through a funding simulation:

Parameters:

Sale cap = 300,000 NLT

Base price = 1 USDT

Slope = 0.001 USDT/token

Accepted token = USDT

Step 1: First Buy
User wants to buy 150,000 NLT tokens:
```makefile
cost = 150,000 * 1 + 0.001 * (150,000 * 0 + 150,000 * 149,999 / 2)
     = 150,000 + 0.001 * (11,249,925,000)
     = 150,000 + 11,249.93 = 161,249.93 USDT
```

The contract calculates this, transfers USDT, and mints 150,000 NLT to the user.

Step 2: Second Buy
Another user buys remaining 150,000 NLT:
```java
Starting totalMinted = 150,000
cost = 150,000 * 1 + 0.001 * (150,000 * 150,000 + 150,000 * 149,999 / 2)
     = 150,000 + 0.001 * (22,500,000,000 + 11,249,925,000)
     = 150,000 + 33,749,925 = 183,749.93 USDT
```

Tech Stack
Layer	Tech
Smart Contracts	Solidity on Neon EVM
Bridging	Neon Composability Layer
Solana Interaction	Raydium pool contracts (IDL + custom bindings)
Frontend	Hardhat / Forge + ethers.js
Token	ERC20
Funding Asset	USDT (Neon-compatible)