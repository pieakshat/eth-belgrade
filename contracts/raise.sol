// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import {LaunchERC20Tokens} from "./LaunchERC20.sol";
import {CallRaydiumProgram} from "./solanaInteraction.sol"; 

contract RasieFunding is Ownable {
    
    // error FundingPeriodEnded();
    error ZeroAmount();
    error UsdtTransferFailed();

    
    mapping(address => uint256) public usdtSent;
    // uint256 public immutable deadline;
    IERC20 public immutable USDT;
    LaunchERC20Tokens public launchToken;
    uint256 public basePrice;
    uint256 public slope;
    CallRaydiumProgram public raydiumPool; 
    
    event TokensBought(address indexed buyer, uint256 tokensBought);
    event RaydiumPoolCreated(bytes32 poolAddr, address launchedToken); 

    /// @notice Constructor to initialize funding contract
    /// @param _usdt Address of the USDT token contract
    /// @param name Name of the ERC20 token to be launched
    /// @param symbol Symbol of the ERC20 token
    /// @param maxSupply Max supply of the token
    /// @param _basePrice Initial price per token
    /// @param _slope The slope value for the bonding curve pricing
    constructor(
        address _usdt,
        // uint256 _deadline, // Funding period end time
        string memory name,
        string memory symbol,
        uint256 maxSupply,
        uint256 _basePrice, // 1e18-scaled
        uint256 _slope  // 1e18-scaled 
    ) Ownable(msg.sender) {
        USDT = IERC20(_usdt);
        launchToken = new LaunchERC20Tokens(name, symbol, maxSupply, address(this), msg.sender);
        basePrice = _basePrice;
        slope = _slope;

        raydiumPool = new CallRaydiumProgram(); 
    }

    /// @notice Calculates how many tokens can be minted for a given amount of USDT
    /// @param usdtAmount Amount of USDT sent
    /// @return tokensToMint Number of tokens that will be minted
function getAmount(uint256 usdtAmount) public view returns (uint256) {
    uint256 p = basePrice + slope * launchToken.saleMinted();   // 1e18-scaled
    return (usdtAmount * 1e18) / p;                             // divide, keep 18 dec
}

    /// @notice Calculates how much USDT is required to buy a specific number of tokens
    /// @param tokensToBuy Number of tokens user wants to buy
    /// @return usdtRequired Amount of USDT required to buy the tokens
function getUsdtToPay(uint256 tokensToBuy) public view returns (uint256) {
    uint256 p = basePrice + slope * launchToken.saleMinted();   // 1e18-scaled
    return (tokensToBuy * p) / 1e18;
}

    /// @notice Buy tokens from the bonding curve by sending USDT
    /// @dev Requires user to approve USDT first
    /// @param usdtAmount Amount of USDT the user is sending
    function buyFromBondingCurve(uint256 usdtAmount) external {
        // if (block.timestamp >= deadline) revert FundingPeriodEnded();
        if (usdtAmount == 0) revert ZeroAmount();
        if (!USDT.transferFrom(msg.sender, address(this), usdtAmount)) revert UsdtTransferFailed();

        uint256 tokensToMint = getAmount(usdtAmount);
        launchToken.mint(msg.sender, tokensToMint);
        usdtSent[msg.sender] += usdtAmount;

        emit TokensBought(msg.sender, tokensToMint);
        if (launchToken.saleMinted() >= (launchToken.maxSupply() * 30) / 100) {
           // If we reach the sale limit, finalise the bonding curve
            finalise();
        }
    }

    /// @notice Lock sale and prepare liquidity at the terminal curve price
    function finalise() internal {
        uint256 raydiumReserve = launchToken.balanceOf(address(this)); // 40 % of supply, sent intially by launchERC20 
        uint256 usdtReserve    = USDT.balanceOf(address(this));        // all USDT raised

        if (raydiumReserve == 0 || usdtReserve == 0) revert ZeroAmount();

    
        // Price at which the bonding curve ended (USDT per token, 1e18-scaled)
        uint256 finalPrice = basePrice + (slope * launchToken.saleMinted());

        
        //     USDT needed to pair the ENTIRE token reserve at that price
        //     usdtNeeded = tokens * price   (scale adjustment: / 1e18)
        uint256 usdtNeeded = (raydiumReserve * finalPrice) / 1e18;

        
        // Determine how much we can actually send
        uint256 tokensToSend;
        uint256 usdtToSend;

        if (usdtReserve >= usdtNeeded) {
            // We have enough USDT to match all tokens
            tokensToSend = raydiumReserve;
            usdtToSend   = usdtNeeded;
        } else {
            // USDT is the limiting side → scale tokens down to match
            usdtToSend   = usdtReserve;
            tokensToSend = (usdtReserve * 1e18) / finalPrice; 
        }

    launchToken.approve(address(raydiumPool), tokensToSend);
    USDT.approve(address(raydiumPool), usdtToSend);

    // create raydium pool
    

    bytes32 poolAddr = raydiumPool.createPool(
        address(launchToken),
        address(USDT),
        uint64(tokensToSend),
        uint64(usdtToSend),
        uint64(block.timestamp) 
    );

    emit RaydiumPoolCreated(poolAddr, address(launchToken));
}
}
