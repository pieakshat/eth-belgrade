import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

import {
    RasieFunding__factory,
    LaunchERC20Tokens__factory,
    MockUSDT__factory,
} from "../typechain-types";

/* ── CONFIG (paste from deploy output) ───────────────────────────── */
const RASIE_ADDR = "0x73028149ccC43b5781faE7f1E1da6D03572673ec"; // RasieFunding
const USDT_ADDR = "0x97F56f5407106f8c1750CE7883A866D71A883fBF"; // MockUSDT
/* ────────────────────────────────────────────────────────────────── */

const decodeRevert = (data: string) => {
    const sel = data.slice(2, 10);
    switch (sel) {
        case "b12d13eb": return "ZeroAmount()";
        case "4bedbe89": return "UsdtTransferFailed()";
        case "cf479181": return "MaxSupplyReached()";
        default: return `Unknown (selector 0x${sel})`;
    }
};

async function main() {
    /* signer ---------------------------------------------------------- */
    const pkBuyer = process.env.PRIVATE_KEY_BUYER;
    if (!pkBuyer) throw new Error("Add PRIVATE_KEY_BUYER to .env");
    const buyer = new ethers.Wallet(pkBuyer, ethers.provider);

    const rasie = RasieFunding__factory.connect(RASIE_ADDR, buyer);
    const usdt = MockUSDT__factory.connect(USDT_ADDR, buyer);

    const decimals = await usdt.decimals();

    /* ── Helpers ───────────────────────────────────────────────────── */
    const fmt = (x: bigint) => ethers.formatUnits(x, decimals);

    /* fund the buyer (for test env) ---------------------------------- */
    await usdt.mint(buyer.address, ethers.parseUnits("2000000000000000000000000000000000000000000000000000", decimals));

    /* approve once ---------------------------------------------------- */
    if ((await usdt.allowance(buyer.address, RASIE_ADDR)) === 0n) {
        console.log("Approving USDT …");
        await (await usdt.approve(RASIE_ADDR, ethers.MaxUint256)).wait();
    }

    /* pull launchToken & saleCap ------------------------------------- */
    const launchAddr = await rasie.launchToken();
    const launch = LaunchERC20Tokens__factory.connect(launchAddr, ethers.provider);

    const maxSupply = await launch.maxSupply();        // 1e18-scaled
    const saleCap = (maxSupply * 30n) / 100n;        // 30 %
    const alreadyMinted = await launch.saleMinted();
    const tokensLeft = saleCap - alreadyMinted;

    console.log("\n─ Sale status ─");
    console.log("sale cap      :", ethers.formatUnits(saleCap), "NLT");
    console.log("alreadyMinted :", ethers.formatUnits(alreadyMinted), "NLT");
    console.log("tokensLeft    :", ethers.formatUnits(tokensLeft), "NLT");

    /* split into two buys -------------------------------------------- */
    const firstBuyTokens = tokensLeft / 2n;           // floor div
    const secondBuyTokens = tokensLeft - firstBuyTokens;

    const execBuy = async (tokenQty: bigint, tag: string) => {
        const usdtNeed = await rasie.getUsdtToPay(tokenQty);
        console.log(`\n${tag} → want ${ethers.formatUnits(tokenQty)} NLT`);
        console.log(`${tag} → need ${fmt(usdtNeed)} USDT`);

        /* preview inverse ------------------------------------------------ */
        const previewTokens = await rasie.getAmount(usdtNeed);
        console.log(`${tag} → previewMint`, ethers.formatUnits(previewTokens), "NLT");

        /* static-call guard --------------------------------------------- */
        try {
            await rasie.buyFromBondingCurve.staticCall(usdtNeed);
        } catch (err: any) {
            const data = err?.error?.data ?? err?.data ?? "";
            console.error(`${tag} 💥 revert →`, decodeRevert(data));
            throw err;
        }

        /* send tx -------------------------------------------------------- */
        const rc = await (await rasie.buyFromBondingCurve(usdtNeed)).wait();
        console.log(`${tag} ✓ tx`, rc?.hash);

        const newMinted = await launch.saleMinted();
        console.log(`${tag} → saleMinted now`, ethers.formatUnits(newMinted), "NLT");
    };

    /* first half ------------------------------------------------------ */
    await execBuy(firstBuyTokens, "1/2");

    /* second half (should trigger finalise) -------------------------- */
    await execBuy(secondBuyTokens, "2/2");

    /* summary --------------------------------------------------------- */
    const finalSale = await launch.saleMinted();
    console.log("\n── Final state ──");
    console.log("saleMinted :", ethers.formatUnits(finalSale), "NLT");
    console.log("Raydium pool:", await rasie.raydiumPool());
}

main().catch((e) => { console.error(e); process.exit(1); });
