import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

import {
    MockUSDT__factory,
    RasieFunding__factory,
    LaunchERC20Tokens__factory,
    CallRaydiumProgram__factory,
} from "../typechain-types";

/* ── CONFIG ────────────────────────────────────────────────────────── */
const EXISTING_USDT = "";                           // put an address or leave ""
const TOKEN_NAME = "Neon Launch Token";
const TOKEN_SYMBOL = "NLT";
const MAX_SUPPLY = ethers.parseUnits("1000000", 18);  // 1 000 000 NLT
const BASE_PRICE = ethers.parseUnits("1", 18);        // 1 USDT
const SLOPE = ethers.parseUnits("0.000001", 18); // tiny linear bump
/* ──────────────────────────────────────────────────────────────────── */

async function main() {
    /* 1. signers ---------------------------------------------------- */
    const deployerPK = process.env.PRIVATE_KEY_DEPLOYER;
    if (!deployerPK) throw new Error("Add PRIVATE_KEY_DEPLOYER to .env");

    const deployer = new ethers.Wallet(deployerPK!, ethers.provider);
    const devWallet = deployer;                     // 30 % dev wallet = deployer

    console.log("Deployer :", deployer.address);

    /* 2. USDT -------------------------------------------------------- */
    let usdtAddr: string;
    if (EXISTING_USDT) {
        usdtAddr = EXISTING_USDT;
        console.log("Using existing USDT at", usdtAddr);
    } else {
        console.log("Deploying MockUSDT …");
        const usdt = await new MockUSDT__factory(deployer).deploy();
        await usdt.waitForDeployment();
        usdtAddr = await usdt.getAddress();
        console.log("MockUSDT deployed:", usdtAddr);
        // mint some USDT for testing
        await (await usdt.mint(devWallet.address, ethers.parseUnits("2000000", 18))).wait();
        console.log("MockUSDT deployed:", usdtAddr);
    }

    /* 3. Deploy RasieFunding ---------------------------------------- */
    console.log("Deploying RasieFunding …");
    const rasie = await new RasieFunding__factory(deployer).deploy(
        usdtAddr,
        TOKEN_NAME,
        TOKEN_SYMBOL,
        MAX_SUPPLY,
        BASE_PRICE,
        SLOPE
    );
    await rasie.waitForDeployment();
    const rasieAddr = await rasie.getAddress();
    console.log("RasieFunding :", rasieAddr);

    /* 4. fetch inner contracts -------------------------------------- */
    const launchAddr = await rasie.launchToken();
    const launch = LaunchERC20Tokens__factory.connect(launchAddr, ethers.provider);
    const raydiumPool = await rasie.raydiumPool();
    console.log("LaunchERC20  :", launchAddr);
    console.log("Raydium shim :", raydiumPool);

    /* 5. summary ----------------------------------------------------- */
    console.log("\n── Parameters ──");
    console.log("BasePrice:", ethers.formatUnits(BASE_PRICE), "USDT");
    console.log("Slope    :", ethers.formatUnits(SLOPE), "USDT / token");
    console.log("MaxSupply:", ethers.formatUnits(MAX_SUPPLY), TOKEN_SYMBOL);

    console.log("\n✅ Deployment finished.  Copy the addresses above into buy.ts");
}

main().catch((e) => { console.error(e); process.exit(1); });
