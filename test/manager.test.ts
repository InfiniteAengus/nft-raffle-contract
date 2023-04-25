import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  Manager,
  Manager__factory,
  MockCoordinator,
  MockCoordinator__factory,
  MockLink,
  MockLink__factory,
  MockNFT,
  MockNFT__factory,
  MockToken,
  MockToken__factory,
} from "../types";
import { deployments } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { Ship } from "../utils";
import { parseEther, solidityKeccak256 } from "ethers/lib/utils";
import { constants } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

chai.use(solidity);
const { expect } = chai;

let ship: Ship;
let manager: Manager;
let linkToken: MockLink;
let vrfCoordinator: MockCoordinator;
let nft: MockNFT;
let token: MockToken;

let deployer: SignerWithAddress;
let alice: SignerWithAddress;
let vault: SignerWithAddress;

enum RaffleType {
  NFT,
  ETH,
  ERC20,
}

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

describe("Raffle Manager test", () => {
  let nftRaffleKey: string;
  let ethRaffleKey: string;
  let erc20RaffleKey: string;
  before(async () => {
    const scaffold = await setup();

    deployer = scaffold.accounts.deployer;
    alice = scaffold.accounts.alice;
    vault = scaffold.accounts.vault;

    manager = await ship.connect(Manager__factory);
    linkToken = await ship.connect(MockLink__factory);
    vrfCoordinator = await ship.connect(MockCoordinator__factory);
    nft = await ship.connect(MockNFT__factory);
    token = await ship.connect(MockToken__factory);

    await manager.grantRole(await manager.OPERATOR_ROLE(), alice.address);
    await linkToken.mint(parseEther("10"));
    await linkToken.transfer(manager.address, parseEther("10"));
  });

  it("create a raffle", async () => {
    const lastblock = await time.latestBlock();
    const chainTime = (await ship.provider.getBlock(lastblock)).timestamp;
    console.log(chainTime);

    const createParams: Manager.RaffleCreateParamStruct = {
      raffleType: RaffleType.NFT,
      desiredFundsInWeis: parseEther("0.1"),
      maxEntriesPerUser: 100,
      collateralAddress: nft.address,
      collateralParam: 1,
      minimumFundsInWeis: parseEther("0.1"),
      commissionInBasicPoints: 500,
      endTime: chainTime + 3600,
    };

    const prices: Manager.PriceStructureStruct[] = [
      {
        id: 0,
        numEntries: 1,
        price: parseEther("0.1"),
      },
      {
        id: 1,
        numEntries: 5,
        price: parseEther("0.4"),
      },
      {
        id: 2,
        numEntries: 10,
        price: parseEther("0.7"),
      },
      {
        id: 3,
        numEntries: 20,
        price: parseEther("0.13"),
      },
      {
        id: 4,
        numEntries: 30,
        price: parseEther("0.19"),
      },
    ];

    const OPERATOR_ROLE = await manager.OPERATOR_ROLE();

    await expect(manager.createRaffle(createParams, prices, [])).to.be.revertedWith(
      `AccessControl: account ${deployer.address.toLowerCase()} is missing role ${OPERATOR_ROLE.toLowerCase()}`,
    );

    await expect(manager.connect(alice).createRaffle(createParams, prices, [])).to.be.revertedWith(
      "ERC721: invalid token ID",
    );

    await nft.connect(alice).mint(1);
    await expect(manager.connect(alice).createRaffle(createParams, prices, [])).to.be.revertedWith(
      "ERC721: caller is not token owner or approved",
    );

    await nft.connect(alice).approve(manager.address, 1);

    const tx = await manager.connect(alice).createRaffle(createParams, prices, []);
    const receipt = await tx.wait();
    const expectKey = solidityKeccak256(
      ["uint8", "address", "uint256", "uint"],
      [RaffleType.NFT, nft.address, 1, receipt.blockNumber],
    );

    const raffleData = await manager.raffles(expectKey);

    expect(raffleData.raffleType).to.eq(RaffleType.NFT);
    expect(raffleData.collateralAddress).to.eq(nft.address);
    expect(raffleData.collateralParam).to.eq(1);
    expect(raffleData.maxEntries).to.eq(100);

    nftRaffleKey = expectKey;
  });

  it("buy entry", async () => {
    await expect(manager.buyEntry(nftRaffleKey, 0, constants.AddressZero, 0)).to.revertedWith(
      "msg.value must be equal to the price",
    );

    await expect(
      manager.buyEntry(nftRaffleKey, 0, constants.AddressZero, 0, {
        value: parseEther("0.1"),
      }),
    )
      .to.be.emit(manager, "EntrySold")
      .withArgs(nftRaffleKey, deployer.address, 0, 0);
  });

  it("finish raffle", async () => {
    await expect(manager.connect(alice).setWinner(nftRaffleKey)).to.revertedWith(
      "Raffle is not finished yet",
    );

    await time.increase(3600);
    await expect(manager.connect(alice).setWinner(nftRaffleKey))
      .to.emit(manager, "SetWinnerTriggered")
      .withArgs(nftRaffleKey, parseEther("0.1"));

    const requestKey = await manager.requestKeys(nftRaffleKey);
    console.log(requestKey);

    await vrfCoordinator.callBackWithRandomness(requestKey, 0, manager.address);
    expect(await nft.ownerOf(1)).to.eq(deployer.address);
  });
});
