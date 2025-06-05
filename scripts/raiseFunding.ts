import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

// ──────  Typechain factories  ──────
import {
    MockUSDT__factory,
    RasieFunding__factory,
    LaunchERC20Tokens__factory,
} from "../typechain-types";

/* --------------------------------------------------------------------- */
/* ▸ helpers: bigint-based “toWei” & MaxUint256 that work for v5 or v6   */
/* --------------------------------------------------------------------- */
const toWei = (n: bigint, decimals = 18n): string =>
    (n * 10n ** decimals).toString();

const MAX_UINT256 =
    // v6 export         // v5 export
    (ethers as any).MaxUint256 ?? (ethers as any).constants.MaxUint256;

async function main() {
    /* ------------------------------------------------------------------- */
    /* ▸ 1.  Load keys & constants                                         */
    /* ------------------------------------------------------------------- */
    const deployerKey = process.env.PRIVATE_KEY_DEPLOYER;
    const buyerKey = process.env.PRIVATE_KEY_BUYER;

    if (!deployerKey || !buyerKey) {
        throw new Error("Set PRIVATE_KEY_DEPLOYER and PRIVATE_KEY_BUYER in .env");
    }

    const provider = ethers.provider;
    const deployer = new ethers.Wallet(deployerKey, provider);
    const buyer = new ethers.Wallet(buyerKey, provider);

    const TOTAL_SUPPLY = toWei(1_000_000n);   // 1 000 000 tokens (18 dec)
    const BASE_PRICE = toWei(1n);           // 1 USDT  (18 dec)
    const SLOPE = 0;                   // flat curve (testing)
    const USDT_FOR_BUYER = toWei(1_000_000n); // plenty

    /* ------------------------------------------------------------------- */
    /* ▸ 2.  Deploy contracts                                              */
    /* ------------------------------------------------------------------- */
    console.log("⛏  Deploying MockUSDT …");
    const usdt = await new MockUSDT__factory(deployer).deploy();
    await usdt.waitForDeployment();
    const usdtAddress = await usdt.getAddress();
    console.log("   → MockUSDT @", usdtAddress);

    console.log("⛏  Deploying RasieFunding …");
    const rasie = await new RasieFunding__factory(deployer).deploy(
        usdtAddress,
        "NeonTestToken",
        "NTT",
        TOTAL_SUPPLY,
        BASE_PRICE,
        SLOPE
    );
    await rasie.waitForDeployment();
    const raiseAddress = await rasie.getAddress();
    console.log("   → RasieFunding @", raiseAddress);

    /* ------------------------------------------------------------------- */
    /* ▸ 3.  Fund buyer with USDT & approve                                */
    /* ------------------------------------------------------------------- */
    await (
        await usdt.connect(deployer).mint(buyer.address, USDT_FOR_BUYER)
    ).wait();

    await (
        await usdt.connect(buyer).approve(raiseAddress, MAX_UINT256)
    ).wait();

    /* ------------------------------------------------------------------- */
    /* ▸ 4.  Buyer purchases ENTIRE 30 % sale allocation                   */
    /* ------------------------------------------------------------------- */
    const tokensForSale = (BigInt(TOTAL_SUPPLY) * 30n) / 100n; // 30 %
    const usdtRequired = await rasie.getUsdtToPay(tokensForSale.toString());

    await (
        await rasie.connect(buyer).buyFromBondingCurve(usdtRequired)
    ).wait();

    /* ------------------------------------------------------------------- */
    /* ▸ 5.  Log final state                                               */
    /* ------------------------------------------------------------------- */
    const poolAddr = await rasie.raydiumPool();
    const ltAddr = await rasie.launchToken();
    const launchToken = LaunchERC20Tokens__factory.connect(ltAddr, provider);

    const fundingUsdtBal = await usdt.balanceOf(raiseAddress);
    const buyerTokenBal = await launchToken.balanceOf(buyer.address);
    const saleMinted = await launchToken.saleMinted();

    console.log("\n────────────────────────────────────────────────────────");
    console.log("Raydium helper address:", poolAddr);
    console.log("USDT address:", usdtAddress);
    console.log("Launch token address:", ltAddr);
    console.log("USDT balance (funding):", fundingUsdtBal.toString());
    console.log("Buyer token balance:", buyerTokenBal.toString());
    console.log("Sale minted:", saleMinted.toString());
    console.log("────────────────────────────────────────────────────────");
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
