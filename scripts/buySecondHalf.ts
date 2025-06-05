import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

import {
    RasieFunding__factory,
    LaunchERC20Tokens__factory,
    MockUSDT__factory,
} from "../typechain-types";

/* ── CONFIG (paste from deploy logs) ─────────────────────────────── */
const RASIE_ADDR = "0x55469758b50AA2E5885D328BE8b00BfC39EF70AA";
const USDT_ADDR = "0x72850A78f3A1f71CF9875CCd98891cC8845ac288";
/* ────────────────────────────────────────────────────────────────── */

async function main() {
    /* signer ---------------------------------------------------------- */
    const pkBuyer = process.env.PRIVATE_KEY_BUYER!;
    const buyer = new ethers.Wallet(pkBuyer, ethers.provider);

    const rasie = RasieFunding__factory.connect(RASIE_ADDR, buyer);
    const usdt = MockUSDT__factory.connect(USDT_ADDR, buyer);

    /* decimals helper ------------------------------------------------- */
    const decimals = await usdt.decimals();
    const fmt = (x: bigint) => ethers.formatUnits(x, decimals);

    /* launch token & caps --------------------------------------------- */
    const launchAddr = await rasie.launchToken();
    const launch = LaunchERC20Tokens__factory.connect(launchAddr, ethers.provider);
    const maxSupply = await launch.maxSupply();               // 1e18
    const saleCap = (maxSupply * 30n) / 100n;               // 30 %
    const alreadyMinted = await launch.saleMinted();
    const tokensLeft = saleCap - alreadyMinted;

    console.log("\n─ Remaining sale ─");
    console.log("alreadyMinted :", ethers.formatUnits(alreadyMinted), "NLT");
    console.log("tokensLeft    :", ethers.formatUnits(tokensLeft), "NLT");

    /* USDT needed for the rest --------------------------------------- */
    const usdtNeed = await rasie.getUsdtToPay(tokensLeft);
    console.log("USDT required :", fmt(usdtNeed), "USDT");

    /* fund buyer (mock only) ----------------------------------------- */
    await usdt.mint(buyer.address, usdtNeed * 2n); // 2× buffer
    console.log("Minted USDT   :", fmt(usdtNeed * 2n));

    /* approve once ---------------------------------------------------- */
    if ((await usdt.allowance(buyer.address, RASIE_ADDR)) < usdtNeed) {
        console.log("Approving USDT …");
        await (await usdt.approve(RASIE_ADDR, ethers.MaxUint256)).wait();
    }

    /* send the buy tx (no staticCall) -------------------------------- */
    console.log("\nBuying remaining tokens …");
    const rc = await (await rasie.buyFromBondingCurve(usdtNeed)).wait();
    console.log("✓ tx hash :", rc?.hash);

    /* summary --------------------------------------------------------- */
    const finalMinted = await launch.saleMinted();
    console.log("\n── Final state ──");
    console.log("saleMinted :", ethers.formatUnits(finalMinted), "NLT");
    console.log("Raydium pool:", await rasie.raydiumPool());
}

main().catch((e) => { console.error(e); process.exit(1); });
