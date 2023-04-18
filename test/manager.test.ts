import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Manager, Manager__factory, MockLink, MockLink__factory } from "../types";
import { deployments } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { Ship } from "../utils";
import { parseEther } from "ethers/lib/utils";
import { constants } from "ethers";

chai.use(solidity);
const { expect } = chai;

let ship: Ship;
let manager: Manager;
let linkToken: MockLink;

let deployer: SignerWithAddress;
let alice: SignerWithAddress;
let vault: SignerWithAddress;

const setup = deployments.createFixture(async (hre) => {
  ship = await Ship.init(hre);
  const { accounts, users } = ship;
  await deployments.fixture(["manager"]);

  return {
    ship,
    accounts,
    users,
  };
});

describe("test", () => {
  before(async () => {
    const scaffold = await setup();

    deployer = scaffold.accounts.deployer;
    alice = scaffold.accounts.alice;
    vault = scaffold.accounts.vault;

    manager = await ship.connect(Manager__factory);
    linkToken = await ship.connect(MockLink__factory);
  });

  it("test", async () => {
    // test here
    // await pool.swapTokens("1", constants.AddressZero, alice.address);
  })
});
