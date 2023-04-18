// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "../standards/ERC677Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol";

contract MockLink is LinkTokenInterface, ERC20 {
  event Transfer(address indexed from, address indexed to, uint value, bytes data);

  constructor() ERC20("Link Token", "LINK") {}

  /**
   * @dev transfer token to a contract address with additional data if the recipient is a contact.
   * @param _to The address to transfer to.
   * @param _value The amount to be transferred.
   * @param _data The extra data to be passed to the receiving contract.
   */
  function transferAndCall(
    address _to,
    uint _value,
    bytes calldata _data
  ) public returns (bool success) {
    super.transfer(_to, _value);
    emit Transfer(msg.sender, _to, _value, _data);
    if (isContract(_to)) {
      contractFallback(_to, _value, _data);
    }
    return true;
  }

  // PRIVATE

  function contractFallback(address _to, uint _value, bytes calldata _data) private {
    ERC677Receiver receiver = ERC677Receiver(_to);
    receiver.onTokenTransfer(msg.sender, _value, _data);
  }

  function isContract(address _addr) private view returns (bool hasCode) {
    uint length;
    assembly {
      length := extcodesize(_addr)
    }
    return length > 0;
  }

  function allowance(
    address owner,
    address spender
  ) public view override(ERC20, LinkTokenInterface) returns (uint256 remaining) {
    remaining = super.allowance(owner, spender);
  }

  function approve(
    address spender,
    uint256 value
  ) public override(ERC20, LinkTokenInterface) returns (bool) {
    return super.approve(spender, value);
  }

  function balanceOf(
    address owner
  ) public view override(ERC20, LinkTokenInterface) returns (uint256 balance) {
    balance = super.balanceOf(owner);
  }

  function decimals()
    public
    view
    override(ERC20, LinkTokenInterface)
    returns (uint8 decimalPlaces)
  {
    decimalPlaces = super.decimals();
  }

  function decreaseApproval(
    address spender,
    uint256 addedValue
  ) public override(LinkTokenInterface) returns (bool success) {
    success = true;
  }

  function increaseApproval(
    address spender,
    uint256 subtractedValue
  ) public override(LinkTokenInterface) {}

  function name()
    public
    view
    override(ERC20, LinkTokenInterface)
    returns (string memory tokenName)
  {
    tokenName = super.name();
  }

  function symbol()
    public
    view
    override(ERC20, LinkTokenInterface)
    returns (string memory tokenSymbol)
  {
    tokenSymbol = super.symbol();
  }

  function totalSupply()
    public
    view
    override(ERC20, LinkTokenInterface)
    returns (uint256 totalTokensIssued)
  {
    totalTokensIssued = super.totalSupply();
  }

  function transfer(
    address to,
    uint256 value
  ) public override(ERC20, LinkTokenInterface) returns (bool success) {
    success = super.transfer(to, value);
  }

  function transferFrom(
    address from,
    address to,
    uint256 value
  ) public override(ERC20, LinkTokenInterface) returns (bool success) {
    success = super.transferFrom(from, to, value);
  }
}
