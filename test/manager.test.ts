import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  Manager,
  Manager__factory,
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
    nft = await ship.connect(MockNFT__factory);
    token = await ship.connect(MockToken__factory);

    await manager.grantRole(await manager.OPERATOR_ROLE(), alice.address);
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

  // it("stake nft test", async () => {
  //   await expect(manager.stakeNFT(nftRaffleKey)).to.be.revertedWith("ERC721: invalid token ID");

  //   await nft.mint(1);
  //   await expect(manager.stakeNFT(nftRaffleKey)).to.be.revertedWith(
  //     "ERC721: caller is not token owner or approved",
  //   );

  //   await nft.approve(manager.address, 1);
  //   await manager.stakeNFT(nftRaffleKey);

  //   const raffleData = await manager.raffles(nftRaffleKey);
  //   expect(raffleData.seller).to.eq(deployer.address);
  //   expect(await nft.ownerOf(1)).to.eq(manager.address);
  // });

  // it("stake token test", async () => {
  //   await expect(manager.stakeERC20(erc20RaffleKey)).to.be.revertedWith("ERC20: insufficient allowance");

  //   await token.approve(manager.address, parseEther("10"));
  //   await expect(manager.stakeERC20(erc20RaffleKey)).to.be.revertedWith(
  //     "ERC20: transfer amount exceeds balance",
  //   );

  //   await token.mint(parseEther("10"));
  //   await manager.stakeERC20(erc20RaffleKey);

  //   const raffleData = await manager.raffles(erc20RaffleKey);
  //   expect(raffleData.seller).to.eq(deployer.address);
  //   expect(await token.balanceOf(manager.address)).to.eq(parseEther("10"));
  // });

  // it("stake eth test", async () => {
  //   await expect(manager.stakeETH(ethRaffleKey)).to.be.revertedWith("Invalid deposit amount");

  //   await manager.stakeETH(ethRaffleKey, {
  //     value: parseEther("10"),
  //   });

  //   const raffleData = await manager.raffles(ethRaffleKey);
  //   expect(raffleData.seller).to.eq(deployer.address);
  //   expect(await ship.provider.getBalance(manager.address)).to.eq(parseEther("10"));
  // });
});
