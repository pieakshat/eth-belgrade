// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Constants } from "@neonevm/call-solana/composability/libraries/Constants.sol";
import { CallSolanaHelperLib } from "@neonevm/call-solana/utils/CallSolanaHelperLib.sol";
import { LibAssociatedTokenData } from "@neonevm/call-solana/composability/libraries/associated-token-program/LibAssociatedTokenData.sol";
import { LibRaydiumProgram } from "@neonevm/call-solana/composability/libraries/raydium-program/LibRaydiumProgram.sol";

import { ICallSolana } from "@neonevm/call-solana/precompiles/ICallSolana.sol";

interface IERC20ForSpl {
    function transferSolana(bytes32 to, uint64 amount) external returns(bool);
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external;
    function tokenMint() external view returns(bytes32);
}

contract CallRaydiumProgram {
    ICallSolana public constant CALL_SOLANA = ICallSolana(0xFF00000000000000000000000000000000000006);

    error InvalidTokens();

    function createPool(
        address tokenA,
        address tokenB,
        uint64 mintAAmount,
        uint64 mintBAmount,
        uint64 startTime
    ) public returns(bytes32) {
        bytes32 tokenAMint = IERC20ForSpl(tokenA).tokenMint();
        bytes32 tokenBMint = IERC20ForSpl(tokenB).tokenMint();
        bytes32 payerAccount = CALL_SOLANA.getPayer();
        bytes32 tokenA_ATA = LibAssociatedTokenData.getAssociatedTokenAccount(tokenAMint, payerAccount);
        bytes32 tokenB_ATA = LibAssociatedTokenData.getAssociatedTokenAccount(tokenBMint, payerAccount);

        IERC20ForSpl(tokenA).transferFrom(msg.sender, address(this), mintAAmount);
        IERC20ForSpl(tokenA).transferSolana(
            tokenA_ATA,
            mintAAmount
        );

        IERC20ForSpl(tokenB).transferFrom(msg.sender, address(this), mintBAmount);
        IERC20ForSpl(tokenB).transferSolana(
            tokenB_ATA,
            mintBAmount
        );

        bytes32[] memory premadeAccounts = new bytes32[](20);
        premadeAccounts[0] = payerAccount;
        premadeAccounts[7] = tokenA_ATA;
        premadeAccounts[8] = tokenB_ATA;

        (
            uint64 lamports,
            bytes32[] memory accounts,
            bool[] memory isSigner,
            bool[] memory isWritable,
            bytes memory data
        ) = LibRaydiumProgram.createPoolInstruction(tokenAMint, tokenBMint, mintAAmount, mintBAmount, startTime, 0, true, premadeAccounts);

        CALL_SOLANA.execute(
            lamports,
            CallSolanaHelperLib.prepareSolanaInstruction(
                Constants.getCreateCPMMPoolProgramId(),
                accounts,
                isSigner,
                isWritable,
                data
            )
        );

        return accounts[3]; // poolId
    }
}