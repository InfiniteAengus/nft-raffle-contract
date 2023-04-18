// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@chainlink/contracts/src/v0.8/mocks/VRFCoordinatorMock.sol";

contract MockCoordinator is VRFCoordinatorMock {
  constructor(address _link) VRFCoordinatorMock(_link) {}
}
