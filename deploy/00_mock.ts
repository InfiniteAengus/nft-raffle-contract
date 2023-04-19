import { DeployFunction } from "hardhat-deploy/types";
import { MockCoordinator__factory, MockLink__factory, MockNFT__factory, MockToken__factory } from "../types";
import { Ship } from "../utils";

const func: DeployFunction = async (hre) => {
  const { deploy, accounts } = await Ship.init(hre);

  if (!hre.network.tags.live) {
    const linkToken = await deploy(MockLink__factory);
    await deploy(MockCoordinator__factory, {
      args: [linkToken.address]
    });
    await deploy(MockNFT__factory);
    await deploy(MockToken__factory);
  }
};

export default func;
func.tags = ["mock"];
