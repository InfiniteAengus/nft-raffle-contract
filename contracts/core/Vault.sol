// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title Vault contract
/// @notice all operator raffle funds and platform fee saves on here.
/// referral system integrated to this contract
/// @dev users can withdraw referral reward in this contract with backend signatures
contract Vault is Ownable {
  using ECDSA for bytes32;

  // events
  /// @dev triggers when claimed referral reward
  event ReferralRewardClaimed(address indexed to, uint256 amount);

  /// @dev saved last claimed time
  mapping(address => uint256) public claimedDate;
  /// @dev signer address
  address public signer;

  /// @param _signer signer address
  constructor(address _signer) {
    require(_signer != address(0), "INVALID_SIGNER");
    signer = _signer;
  }

  // fallback function to accept eth
  receive() external payable {}

  fallback() external payable {}

  // external functions
  /// @param amount amount to claim
  /// @param signature sigature of signer
  function claimReferralReward(uint256 amount, bytes calldata signature) external {
    require(_validateClaimParams(amount, msg.sender, signature), "Invalid signature");

    (bool sent, ) = msg.sender.call{value: amount}("");
    require(sent, "Failed to send Ether");
    claimedDate[msg.sender] = block.timestamp;

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
  /// @param _amount amount to claim
  /// @param _claimer address of claimer
  /// @param _signature signature of signer
  /// @dev validate claim amount of user
  function _validateClaimParams(
    uint256 _amount,
    address _claimer,
    bytes calldata _signature
  ) internal view returns (bool) {
    bytes32 hash = keccak256(abi.encodePacked(_claimer, _amount, claimedDate[_claimer]));
    bytes32 message = ECDSA.toEthSignedMessageHash(hash);
    address recoveredAddress = ECDSA.recover(message, _signature);

    return (recoveredAddress == signer);
  }
}
