// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
  constructor() ERC20("Test NFT", "NFT") {}

  function mint(uint256 amount) external {
    _mint(msg.sender, amount);
  }
}
