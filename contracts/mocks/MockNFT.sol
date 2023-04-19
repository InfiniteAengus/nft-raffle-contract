// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockNFT is ERC721 {
  constructor() ERC721("Test NFT", "NFT") {}

  function mint(uint256 tokenId) external {
    _mint(msg.sender, tokenId);
  }
}
