import { deployments } from "hardhat";
import { Ship } from "../utils";
import { Manager, Manager__factory } from "../types";
import { constants } from "ethers";
import { parseEther } from "ethers/lib/utils";

enum RaffleType {
  NFT,
  ETH,
  ERC20,
}

const main = async () => {
  const setup = deployments.createFixture(async (hre) => {
    const ship = await Ship.init(hre);
    const { accounts, users } = ship;

    return {
      ship,
      accounts,
      users,
    };
  });

  const {accounts, ship} = await setup();
  const signer = accounts.signer;

  const manager = await ship.connect(Manager__factory);
  const chainTime = (await ship.provider.getBlock('latest')).timestamp;

  const createParams: Manager.OperatorCreateParamStruct = {
    raffleType: RaffleType.ETH,
    collateralAddress: constants.AddressZero,
    collateralParam: parseEther("0.00001"),
    minTicketCount: 0,
    maxTicketCount: 10,
    endTime: chainTime + 10,
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

  // let tx = await manager.grantRole(await manager.OPERATOR_ROLE(), signer.address);
  // await tx.wait();

  // let tx = await manager.connect(signer).operatorCreateRaffle(createParams, prices, [], {
  //   value: parseEther("0.00001"),
  // });
  // await tx.wait()

  let tx = await manager.connect(signer).setWinner('0xf70ec7d768bb70a9e50e38c6d31a359d45ca4ae58dc37363516410eee0e3ac68');
  await tx.wait();
}

main().then(() => console.log("finished")).catch((err) => console.log(err?.message ?? err?.reason ?? err))