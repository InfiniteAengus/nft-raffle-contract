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
  Vault,
  Vault__factory,
} from "../types";
import { deployments } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { Ship } from "../utils";
import { arrayify, parseEther, solidityKeccak256, splitSignature } from "ethers/lib/utils";
import { constants } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { signMessage } from "../utils/signature";

chai.use(solidity);
const { expect } = chai;

let ship: Ship;
let manager: Manager;
let linkToken: MockLink;
let vrfCoordinator: MockCoordinator;
let nft: MockNFT;
let token: MockToken;
let vault: Vault;

let deployer: SignerWithAddress;
let alice: SignerWithAddress;
let signer: SignerWithAddress;

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

const sign = async (to: string, collection: string) => {
  const hash = solidityKeccak256(["address", "address"], [to, collection]);
  const sig = await signer.signMessage(arrayify(hash));
  const { r, s, v } = splitSignature(sig);
  return {
    r,
    s,
    v,
  };
};

describe("Raffle Manager test", () => {
  let nftRaffleKey: string;
  before(async () => {
    const scaffold = await setup();

    deployer = scaffold.accounts.deployer;
    alice = scaffold.accounts.alice;
    signer = scaffold.accounts.signer;

    manager = await ship.connect(Manager__factory);
    linkToken = await ship.connect(MockLink__factory);
    vrfCoordinator = await ship.connect(MockCoordinator__factory);
    nft = await ship.connect(MockNFT__factory);
    token = await ship.connect(MockToken__factory);
    vault = Vault__factory.connect((await deployments.get("Vault")).address, deployer);

    await manager.grantRole(await manager.OPERATOR_ROLE(), alice.address);
    await linkToken.mint(parseEther("10"));
    await linkToken.transfer(manager.address, parseEther("10"));
  });

  describe("admin raffle test", async () => {
    it("admin create a raffle", async () => {
      const lastBlock = await time.latestBlock();
      const chainTime = (await ship.provider.getBlock(lastBlock)).timestamp;

      const createParams: Manager.OperatorCreateParamStruct = {
        raffleType: RaffleType.NFT,
        collateralAddress: nft.address,
        collateralParam: 1,
        minTicketCount: 5,
        maxTicketCount: 10,
        endTime: chainTime + 3600,
      };

      const prices: Manager.PriceStructureStruct[] = [
        {
          id: 0,
          numTickets: 1,
          price: parseEther("0.1"),
        },
        {
          id: 1,
          numTickets: 5,
          price: parseEther("0.4"),
        },
        {
          id: 2,
          numTickets: 10,
          price: parseEther("0.7"),
        },
        {
          id: 3,
          numTickets: 20,
          price: parseEther("0.13"),
        },
        {
          id: 4,
          numTickets: 30,
          price: parseEther("0.19"),
        },
      ];

      const OPERATOR_ROLE = await manager.OPERATOR_ROLE();

      await expect(manager.operatorCreateRaffle(createParams, prices, [])).to.be.revertedWith(
        `AccessControl: account ${deployer.address.toLowerCase()} is missing role ${OPERATOR_ROLE.toLowerCase()}`,
      );

      await expect(manager.connect(alice).operatorCreateRaffle(createParams, prices, [])).to.be.revertedWith(
        "ERC721: invalid token ID",
      );

      await nft.connect(alice).mint(1);
      await expect(manager.connect(alice).operatorCreateRaffle(createParams, prices, [])).to.be.revertedWith(
        "ERC721: caller is not token owner or approved",
      );

      await nft.connect(alice).approve(manager.address, 1);

      const tx = await manager.connect(alice).operatorCreateRaffle(createParams, prices, []);
      const receipt = await tx.wait();
      const expectKey = solidityKeccak256(
        ["uint8", "address", "uint256", "uint"],
        [RaffleType.NFT, nft.address, 1, receipt.blockNumber],
      );

      const raffleData = await manager.raffles(expectKey);

      expect(raffleData.raffleType).to.eq(RaffleType.NFT);
      expect(raffleData.collateralAddress).to.eq(nft.address);
      expect(raffleData.collateralParam).to.eq(1);

      nftRaffleKey = expectKey;
    });

    it("buy entry in operator raffles", async () => {
      await expect(manager.buyEntry(nftRaffleKey, 0, constants.AddressZero, 0)).to.revertedWith(
        "msg.value must be equal to the price",
      );

      await expect(
        manager.buyEntry(nftRaffleKey, 0, constants.AddressZero, 0, {
          value: parseEther("0.1"),
        }),
      )
        .to.be.emit(manager, "EntrySold")
        .withArgs(nftRaffleKey, deployer.address, 1, 1, parseEther("0.1"));

      await expect(
        manager.buyEntry(nftRaffleKey, 1, constants.AddressZero, 0, {
          value: parseEther("0.4"),
        }),
      )
        .to.be.emit(manager, "EntrySold")
        .withArgs(nftRaffleKey, deployer.address, 5, 2, parseEther("0.4"));

      await expect(
        manager.buyEntry(nftRaffleKey, 1, constants.AddressZero, 0, {
          value: parseEther("0.4"),
        }),
      ).to.revertedWith("Max ticket amount exceed");

      await time.increase(3600);

      await expect(
        manager.buyEntry(nftRaffleKey, 0, constants.AddressZero, 0, {
          value: parseEther("0.1"),
        }),
      ).to.revertedWith("Raffle already finished");
    });

    it("finish raffle", async () => {
      await expect(manager.connect(alice).setWinner(nftRaffleKey))
        .to.emit(manager, "SetWinnerTriggered")
        .withArgs(nftRaffleKey, parseEther("0.5"));
    });
  });

  describe("user raffle test", async () => {
    it("user create a raffle", async () => {
      const lastBlock = await time.latestBlock();
      const chainTime = (await ship.provider.getBlock(lastBlock)).timestamp;

      const createParams: Manager.UserCreateParamStruct = {
        raffleType: RaffleType.NFT,
        collateralAddress: nft.address,
        collateralParam: 2,
        ticketSupply: 10,
        ticketPrice: parseEther("0.1"),
        endTime: chainTime + 24 * 3600 + 10,
      };

      await nft.connect(alice).mint(2);
      await nft.connect(alice).approve(manager.address, 2);

      let sig = await sign(deployer.address, nft.address);

      await expect(manager.connect(alice).userCreateRaffle(createParams, [], sig)).to.be.revertedWith(
        "This collection is not whitelisted",
      );

      sig = await sign(alice.address, nft.address);

      const tx = await manager.connect(alice).userCreateRaffle(createParams, [], sig);
      const receipt = await tx.wait();
      const expectKey = solidityKeccak256(
        ["uint8", "address", "uint256", "uint"],
        [RaffleType.NFT, nft.address, 2, receipt.blockNumber],
      );

      const raffleData = await manager.raffles(expectKey);

      expect(raffleData.raffleType).to.eq(RaffleType.NFT);
      expect(raffleData.collateralAddress).to.eq(nft.address);
      expect(raffleData.collateralParam).to.eq(2);

      nftRaffleKey = expectKey;
    });

    it("buy entry in user raffles", async () => {
      await expect(manager.buyEntry(nftRaffleKey, 0, constants.AddressZero, 0)).to.revertedWith(
        "Ticket count should bigger than 0",
      );

      await expect(
        manager.buyEntry(nftRaffleKey, 1, constants.AddressZero, 0, {
          value: parseEther("0.1"),
        }),
      )
        .to.be.emit(manager, "EntrySold")
        .withArgs(nftRaffleKey, deployer.address, 1, 1, parseEther("0.1"));

      await expect(
        manager.buyEntry(nftRaffleKey, 5, constants.AddressZero, 0, {
          value: parseEther("0.5"),
        }),
      ).to.revertedWith("Bought too many entries()");

      await time.increase(24 * 3600 + 10);

      await expect(
        manager.buyEntry(nftRaffleKey, 1, constants.AddressZero, 0, {
          value: parseEther("0.1"),
        }),
      ).to.revertedWith("Raffle already finished");
    });

    it("finish raffle", async () => {
      await expect(manager.connect(alice).setWinner(nftRaffleKey))
        .to.emit(manager, "SetWinnerTriggered")
        .withArgs(nftRaffleKey, parseEther("0.1"));
    });
  });

  describe("Signer test: ", () => {
    it(" Sign Message", async () => {
      const amount = "50000";
      const date = 0;

      const signature = await signMessage(
        signer,
        ["address", "uint256", "uint256"],
        [alice.address, amount, date],
      );

      console.log("signer address: ", signer.address);
      console.log("vault test: ", amount, alice.address, signature);
      await vault.connect(alice).claimReferralReward(amount, signature);
    });
  });

  describe("max buy ticket amount test", async () => {
    it("user create a raffle", async () => {
      const lastBlock = await time.latestBlock();
      const chainTime = (await ship.provider.getBlock(lastBlock)).timestamp;

      const createParams: Manager.UserCreateParamStruct = {
        raffleType: RaffleType.NFT,
        collateralAddress: nft.address,
        collateralParam: 2,
        ticketSupply: 300,
        ticketPrice: parseEther("0.0007"),
        endTime: chainTime + 24 * 3600 + 10,
      };

      await nft.connect(alice).mint(2);
      await nft.connect(alice).approve(manager.address, 2);

      let sig = await sign(deployer.address, nft.address);

      await expect(manager.connect(alice).userCreateRaffle(createParams, [], sig)).to.be.revertedWith(
        "This collection is not whitelisted",
      );

      sig = await sign(alice.address, nft.address);

      const tx = await manager.connect(alice).userCreateRaffle(createParams, [], sig);
      const receipt = await tx.wait();
      const expectKey = solidityKeccak256(
        ["uint8", "address", "uint256", "uint"],
        [RaffleType.NFT, nft.address, 2, receipt.blockNumber],
      );

      const raffleData = await manager.raffles(expectKey);

      expect(raffleData.raffleType).to.eq(RaffleType.NFT);
      expect(raffleData.collateralAddress).to.eq(nft.address);
      expect(raffleData.collateralParam).to.eq(2);

      nftRaffleKey = expectKey;
    });

    it("buy entry in user raffles", async () => {
      await expect(manager.buyEntry(nftRaffleKey, 0, constants.AddressZero, 0)).to.revertedWith(
        "Ticket count should bigger than 0",
      );

      await expect(
        manager.buyEntry(nftRaffleKey, 1, constants.AddressZero, 0, {
          value: parseEther("0.0007"),
        }),
      )
        .to.be.emit(manager, "EntrySold")
        .withArgs(nftRaffleKey, deployer.address, 1, 1, parseEther("0.0007"));

      await expect(
        manager.buyEntry(nftRaffleKey, 60, constants.AddressZero, 0, {
          value: parseEther("0.042"),
        }),
      ).to.revertedWith("Bought too many entries()");

      await time.increase(24 * 3600 + 10);

      await expect(
        manager.buyEntry(nftRaffleKey, 1, constants.AddressZero, 0, {
          value: parseEther("0.1"),
        }),
      ).to.revertedWith("Raffle already finished");
    });

    // it("change max buy ticket amount", async () => {
    //   await expect(manager.setMaxTicketCount(nftRaffleKey, 0)).to.revertedWith(
    //     "Max ticket count must be greater than 0",
    //   );

    //   await expect(manager.setMaxTicketCount(nftRaffleKey, 101)).to.revertedWith(
    //     "Max ticket count must be less than or equal to the max ticket count of the funding",
    //   );

    //   await expect(manager.setMaxTicketCount(nftRaffleKey, 30))
    //     .to.be.emit(manager, "MaxTicketAmountPerBuyerUpdated")
    //     .withArgs(nftRaffleKey, 30);
    // });
  });

  describe("admin raffle test", async () => {
    it("admin create a raffle", async () => {
      const lastBlock = await time.latestBlock();
      const chainTime = (await ship.provider.getBlock(lastBlock)).timestamp;

      const createParams: Manager.OperatorCreateParamStruct = {
        raffleType: RaffleType.NFT,
        collateralAddress: nft.address,
        collateralParam: 1,
        minTicketCount: 5,
        maxTicketCount: 10,
        endTime: chainTime + 3600,
      };

      const prices: Manager.PriceStructureStruct[] = [
        {
          id: 0,
          numTickets: 1,
          price: parseEther("0.1"),
        },
        {
          id: 1,
          numTickets: 5,
          price: parseEther("0.4"),
        },
        {
          id: 2,
          numTickets: 10,
          price: parseEther("0.7"),
        },
        {
          id: 3,
          numTickets: 20,
          price: parseEther("0.13"),
        },
        {
          id: 4,
          numTickets: 30,
          price: parseEther("0.19"),
        },
      ];

      const OPERATOR_ROLE = await manager.OPERATOR_ROLE();

      await expect(manager.operatorCreateRaffle(createParams, prices, [])).to.be.revertedWith(
        `AccessControl: account ${deployer.address.toLowerCase()} is missing role ${OPERATOR_ROLE.toLowerCase()}`,
      );

      await expect(manager.connect(alice).operatorCreateRaffle(createParams, prices, [])).to.be.revertedWith(
        "ERC721: invalid token ID",
      );

      await nft.connect(alice).mint(1);
      await expect(manager.connect(alice).operatorCreateRaffle(createParams, prices, [])).to.be.revertedWith(
        "ERC721: caller is not token owner or approved",
      );

      await nft.connect(alice).approve(manager.address, 1);

      const tx = await manager.connect(alice).operatorCreateRaffle(createParams, prices, []);
      const receipt = await tx.wait();
      const expectKey = solidityKeccak256(
        ["uint8", "address", "uint256", "uint"],
        [RaffleType.NFT, nft.address, 1, receipt.blockNumber],
      );

      const raffleData = await manager.raffles(expectKey);

      expect(raffleData.raffleType).to.eq(RaffleType.NFT);
      expect(raffleData.collateralAddress).to.eq(nft.address);
      expect(raffleData.collateralParam).to.eq(1);

      nftRaffleKey = expectKey;
    });

    it("buy entry in operator raffles with discount", async () => {
      const signature = await signMessage(
        signer,
        ["address", "address", "uint256"],
        [alice.address, nft.address, 8],
      );

      await expect(
        manager.connect(alice).buyDiscountEntry(nftRaffleKey, 0, constants.AddressZero, 0, 8, signature, {
          value: parseEther("0.1"),
        }),
      ).to.revertedWith("Invalid signature");

      await expect(
        manager.connect(alice).buyDiscountEntry(nftRaffleKey, 0, nft.address, 1, 8, signature),
      ).to.revertedWith("msg.value must be equal to the price");

      await expect(
        manager.connect(alice).buyDiscountEntry(nftRaffleKey, 0, nft.address, 1, 8, signature, {
          value: parseEther("0.1"),
        }),
      ).to.revertedWith("msg.value must be equal to the price");

      await expect(
        manager.connect(alice).buyDiscountEntry(nftRaffleKey, 0, nft.address, 1, 8, signature, {
          value: parseEther("0.092"),
        }),
      )
        .to.be.emit(manager, "EntrySold")
        .withArgs(nftRaffleKey, alice.address, 1, 1, parseEther("0.092"));

      await expect(
        manager.connect(alice).buyDiscountEntry(nftRaffleKey, 1, nft.address, 1, 8, signature, {
          value: parseEther("0.368"),
        }),
      )
        .to.be.emit(manager, "EntrySold")
        .withArgs(nftRaffleKey, alice.address, 5, 2, parseEther("0.368"));

      await expect(
        manager.connect(alice).buyDiscountEntry(nftRaffleKey, 1, nft.address, 1, 8, signature, {
          value: parseEther("0.368"),
        }),
      ).to.revertedWith("Max ticket amount exceed");

      await time.increase(3600);

      await expect(
        manager.connect(alice).buyDiscountEntry(nftRaffleKey, 0, constants.AddressZero, 1, 8, signature, {
          value: parseEther("0.092"),
        }),
      ).to.revertedWith("Raffle already finished");
    });
  });

  describe("user free raffle test", async () => {
    it("user create a raffle", async () => {
      const lastBlock = await time.latestBlock();
      const chainTime = (await ship.provider.getBlock(lastBlock)).timestamp;

      const createParams: Manager.UserCreateParamStruct = {
        raffleType: RaffleType.NFT,
        collateralAddress: nft.address,
        collateralParam: 2,
        ticketSupply: 10,
        ticketPrice: parseEther("0.1"),
        endTime: chainTime + 24 * 3600 + 10,
      };

      await nft.connect(alice).mint(2);
      await nft.connect(alice).approve(manager.address, 2);

      let sig = await sign(deployer.address, nft.address);

      await expect(manager.connect(alice).userCreateRaffle(createParams, [], sig)).to.be.revertedWith(
        "This collection is not whitelisted",
      );

      sig = await sign(alice.address, nft.address);

      const tx = await manager.connect(alice).userCreateRaffle(createParams, [], sig);
      const receipt = await tx.wait();
      const expectKey = solidityKeccak256(
        ["uint8", "address", "uint256", "uint"],
        [RaffleType.NFT, nft.address, 2, receipt.blockNumber],
      );

      const raffleData = await manager.raffles(expectKey);

      expect(raffleData.raffleType).to.eq(RaffleType.NFT);
      expect(raffleData.collateralAddress).to.eq(nft.address);
      expect(raffleData.collateralParam).to.eq(2);

      nftRaffleKey = expectKey;
    });

    it("buy entry in user raffles", async () => {
      const signature = await signMessage(
        signer,
        ["address", "bytes32", "uint256"],
        [alice.address, nftRaffleKey, 2],
      );

      const signature2 = await signMessage(
        signer,
        ["address", "bytes32", "uint256"],
        [alice.address, nftRaffleKey, 6],
      );

      await expect(
        manager.connect(alice).buyFreeEntry(nftRaffleKey, 0, constants.AddressZero, 0, signature),
      ).to.revertedWith("Ticket count should bigger than 0");

      await expect(
        manager.connect(alice).buyFreeEntry(nftRaffleKey, 1, constants.AddressZero, 0, signature),
      ).to.revertedWith("Invalid signature");

      await expect(manager.connect(alice).buyFreeEntry(nftRaffleKey, 2, constants.AddressZero, 0, signature))
        .to.be.emit(manager, "EntrySold")
        .withArgs(nftRaffleKey, alice.address, 2, 1, 0);

      await expect(
        manager.connect(alice).buyFreeEntry(nftRaffleKey, 6, constants.AddressZero, 0, signature2),
      ).to.revertedWith("Bought too many entries()");

      await time.increase(24 * 3600 + 10);

      await expect(
        manager.connect(alice).buyFreeEntry(nftRaffleKey, 1, constants.AddressZero, 0, signature),
      ).to.revertedWith("Raffle already finished");
    });

    it("finish raffle", async () => {
      await expect(manager.connect(signer).setWinner(nftRaffleKey))
        .to.emit(manager, "SetWinnerTriggered")
        .withArgs(nftRaffleKey, parseEther("0"));
    });
  });

  describe.only("admin free raffle test", async () => {
    it("admin create a raffle", async () => {
      const lastBlock = await time.latestBlock();
      const chainTime = (await ship.provider.getBlock(lastBlock)).timestamp;

      const createParams: Manager.OperatorCreateParamStruct = {
        raffleType: RaffleType.NFT,
        collateralAddress: nft.address,
        collateralParam: 1,
        minTicketCount: 5,
        maxTicketCount: 10,
        endTime: chainTime + 3600,
      };

      const prices: Manager.PriceStructureStruct[] = [
        {
          id: 0,
          numTickets: 1,
          price: parseEther("0.1"),
        },
        {
          id: 1,
          numTickets: 5,
          price: parseEther("0.4"),
        },
        {
          id: 2,
          numTickets: 10,
          price: parseEther("0.7"),
        },
        {
          id: 3,
          numTickets: 20,
          price: parseEther("0.13"),
        },
        {
          id: 4,
          numTickets: 30,
          price: parseEther("0.19"),
        },
      ];

      const OPERATOR_ROLE = await manager.OPERATOR_ROLE();

      await expect(manager.operatorCreateRaffle(createParams, prices, [])).to.be.revertedWith(
        `AccessControl: account ${deployer.address.toLowerCase()} is missing role ${OPERATOR_ROLE.toLowerCase()}`,
      );

      await expect(manager.connect(alice).operatorCreateRaffle(createParams, prices, [])).to.be.revertedWith(
        "ERC721: invalid token ID",
      );

      await nft.connect(alice).mint(1);
      await expect(manager.connect(alice).operatorCreateRaffle(createParams, prices, [])).to.be.revertedWith(
        "ERC721: caller is not token owner or approved",
      );

      await nft.connect(alice).approve(manager.address, 1);

      const tx = await manager.connect(alice).operatorCreateRaffle(createParams, prices, []);
      const receipt = await tx.wait();
      const expectKey = solidityKeccak256(
        ["uint8", "address", "uint256", "uint"],
        [RaffleType.NFT, nft.address, 1, receipt.blockNumber],
      );

      const raffleData = await manager.raffles(expectKey);

      expect(raffleData.raffleType).to.eq(RaffleType.NFT);
      expect(raffleData.collateralAddress).to.eq(nft.address);
      expect(raffleData.collateralParam).to.eq(1);

      nftRaffleKey = expectKey;
    });

    it("buy entry in admin raffles", async () => {
      const signature = await signMessage(
        signer,
        ["address", "bytes32", "uint256"],
        [alice.address, nftRaffleKey, 2],
      );

      const signature2 = await signMessage(
        signer,
        ["address", "bytes32", "uint256"],
        [alice.address, nftRaffleKey, 6],
      );

      await expect(
        manager.connect(alice).buyFreeEntry(nftRaffleKey, 0, constants.AddressZero, 0, signature),
      ).to.revertedWith("Ticket count should bigger than 0");

      await expect(
        manager.connect(alice).buyFreeEntry(nftRaffleKey, 1, constants.AddressZero, 0, signature),
      ).to.revertedWith("Invalid signature");

      await expect(manager.connect(alice).buyFreeEntry(nftRaffleKey, 2, constants.AddressZero, 0, signature))
        .to.be.emit(manager, "EntrySold")
        .withArgs(nftRaffleKey, alice.address, 2, 1, 0);

      console.log("signature", signature);
      await expect(
        manager.connect(alice).buyFreeEntry(nftRaffleKey, 6, constants.AddressZero, 0, signature2),
      ).to.revertedWith("Bought too many entries()");

      await time.increase(3600);

      await expect(
        manager.connect(alice).buyFreeEntry(nftRaffleKey, 1, constants.AddressZero, 0, signature),
      ).to.revertedWith("Raffle already finished");
    });

    // it("finish raffle", async () => {
    //   await expect(manager.connect(signer).setWinner(nftRaffleKey))
    //     .to.emit(manager, "SetWinnerTriggered")
    //     .withArgs(nftRaffleKey, parseEther("0"));
    // });
  });
});
