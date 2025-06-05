import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

import {
    RasieFunding__factory,
    LaunchERC20Tokens__factory,
    MockUSDT__factory,
} from "../typechain-types";

/* ── CONFIG (paste from deploy output) ───────────────────────────── */
const RASIE_ADDR = "0xe8e489C2fc463c0E91Cba26Cc2d6302423Ce02d3";      // ← RasieFunding from deploy
const USDT_ADDR = "0xaD90728324C7c514A6Eeb2810C96015878bd8134";      // ← Mock/existing USDT
const BUY_USDT = "50000";    // how many USDT to spend
/* ─────────────────────────────────────────────────────────────────── */

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
    const pkBuyer = process.env.PRIVATE_KEY_BUYER;
    if (!pkBuyer) throw new Error("Add PRIVATE_KEY_BUYER to .env");
    const buyer = new ethers.Wallet(pkBuyer, ethers.provider);

    const rasie = RasieFunding__factory.connect(RASIE_ADDR, buyer);
    const usdt = MockUSDT__factory.connect(USDT_ADDR, buyer);

    const decimals = await usdt.decimals();
    const usdtAmount = ethers.parseUnits(BUY_USDT, decimals);

    /* approve if needed -------------------------------------------- */
    if ((await usdt.allowance(buyer.address, RASIE_ADDR)) < usdtAmount) {
        console.log("Approving USDT …");
        await (await usdt.approve(RASIE_ADDR, ethers.MaxUint256)).wait();
    }

    /* preview ------------------------------------------------------- */
    const tokensPreview = await rasie.getAmount(usdtAmount);
    console.log(`Will mint ≈ ${ethers.formatUnits(tokensPreview)} NLT`);

    await usdt.mint(buyer.address, usdtAmount);


    const balance = await usdt.balanceOf(buyer.address);
    console.log("USDT Balance:", ethers.formatUnits(balance, decimals));
    console.log("Trying to spend:", ethers.formatUnits(usdtAmount, decimals));
    const allowance = await usdt.allowance(buyer.address, RASIE_ADDR);
    console.log("Allowance set to:", ethers.formatUnits(allowance, decimals));

    /* dry-run to catch revert -------------------------------------- */
    try {
        await rasie.buyFromBondingCurve.staticCall(usdtAmount);
    } catch (err: any) {
        const data = err?.error?.data ?? err?.data ?? "";
        console.error("💥 Static-call revert →", decodeRevert(data));
        return;
    }

    /* send tx ------------------------------------------------------- */
    console.log("Buying tokens …");
    const receipt = await (await rasie.buyFromBondingCurve(usdtAmount)).wait();
    console.log("✅ Tx mined:", receipt?.hash);

    /* post-state summary ------------------------------------------- */
    const launchAddr = await rasie.launchToken();
    const launch = LaunchERC20Tokens__factory.connect(launchAddr, ethers.provider);
    const buyerBal = await launch.balanceOf(buyer.address);

    console.log("\n── Final state ──");
    console.log("Buyer token bal :", ethers.formatUnits(buyerBal), "NLT");
    console.log("Sale minted     :", ethers.formatUnits(await launch.saleMinted()), "NLT");
    console.log("Raydium pool    :", await rasie.raydiumPool());
}

main().catch((e) => { console.error(e); process.exit(1); });
