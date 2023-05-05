// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Vault contract
/// @notice all operator raffle funds and platform fee saves on here.
/// referral system integrated to this contract
/// @dev users can withdraw referral reward in this contract with backend signatures
contract Vault is Ownable {
  // events
  /// @dev triggers when claimed referral reward
  event ReferralRewardClaimed(address indexed to, uint256 amount);

  /// @dev saved last claimed time
  mapping(address => uint256) public claimedDate;
  /// @dev signer address
  address public signer;

  // signature structure
  struct Sig {
    bytes32 r;
    bytes32 s;
    uint8 v;
  }

  /// @param _signer signer address
  constructor(address _signer) {}

  // fallback function to accept eth
  receive() external payable {}

  fallback() external payable {}

  // external functions
  /// @param amount amount to claim
  /// @param sig sigature of signer
  function claimReferralReward(uint256 amount, Sig calldata sig) external {
    require(_validateClaimParams(amount, sig), "Invalid signature");

    (bool sent, ) = msg.sender.call{value: amount}("");
    require(sent, "Failed to send Ether");

    emit ReferralRewardClaimed(msg.sender, amount);
  }

  /// @param _newAddress new address of the platform signer
  /// @dev Change the wallet of the platform signer
  function setSignerAddress(address payable _newAddress) external onlyOwner {
    signer = _newAddress;
  }

  /// @param amount amount to claim
  /// @dev claim funds
  function claimFund(uint256 amount) external onlyOwner {
    (bool sent, ) = msg.sender.call{value: amount}("");
    require(sent, "Failed to send Ether");
  }

  // internal functions
  /// @param amount amount to claim
  /// @param sig signature of signer
  /// @dev validate claim amount of user
  function _validateClaimParams(uint256 amount, Sig calldata sig) internal view returns (bool) {
    bytes32 messageHash = keccak256(
      abi.encodePacked(_msgSender(), amount, claimedDate[_msgSender()])
    );

    bytes32 ethSignedMessageHash = keccak256(
      abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
    );

    return signer == ecrecover(ethSignedMessageHash, sig.v, sig.r, sig.s);
  }
}
