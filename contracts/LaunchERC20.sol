// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Error thrown when trying to mint beyond max supply
error MaxSupplyReached();

contract LaunchERC20Tokens is ERC20, Ownable {
    uint256 public immutable maxSupply;

    /// @dev Tracks only the **sale** mints (30 % allocation)
    uint256 public saleMinted;

    uint256 private constant DEV_PERCENT     = 30;
    uint256 private constant SALE_PERCENT    = 30;
    uint256 private constant LP_PERCENT      = 40;

    /// @param name Token name
    /// @param symbol Token symbol
    /// @param _maxSupply Max supply (in base units, e.g. 1e18 for 1 token)
    /// @param bondingCurve Address that will control minting (BondingCurve contract)
    constructor(
        string memory name,
        string memory symbol,
        uint256 _maxSupply,
        address bondingCurve, 
        address devWallet 
    ) ERC20(name, symbol) Ownable(bondingCurve) {
        maxSupply = _maxSupply;

        uint256 devAllocation = (_maxSupply * DEV_PERCENT) / 100;    // 30% for devs
        uint256 reserveForRaydium = (_maxSupply * LP_PERCENT) / 100; // 40% for raydium after bonding curve is complete 

        _mint(devWallet, devAllocation); // dev gets 30%
        _mint(bondingCurve, reserveForRaydium); // bonding curve gets 40%
    }

    /// @notice Mint new tokens to receiver (only owner/BondingCurve can call)
    /// @param receiver The address receiving minted tokens
    /// @param amount Amount in base units (e.g. 1e18 for 1 token)
    function mint(address receiver, uint256 amount) external onlyOwner {
        if (saleMinted + amount > (maxSupply * SALE_PERCENT) / 100) {
            revert MaxSupplyReached();
        }

        saleMinted += amount;
        _mint(receiver, amount);
    }

    function tokenMint() external view returns (bytes32) {
        return bytes32(uint256(uint160(address(this))));
    }
}
