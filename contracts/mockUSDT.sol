// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDT is ERC20 {
    constructor() ERC20("USDT", "USDT") {
    }

    function mint(address to, uint256 amt) external {
        _mint(to, amt);
    }

    function tokenMint() external view returns (bytes32) {
        return bytes32(uint256(uint160(address(this))));
    }
}