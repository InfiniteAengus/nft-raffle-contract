import { DeployFunction } from "hardhat-deploy/types";
import { MockCoordinator__factory, MockLink__factory } from "../types";
import { Ship } from "../utils";

const func: DeployFunction = async (hre) => {
  const { deploy, accounts } = await Ship.init(hre);

  if (!hre.network.tags.live) {
    const linkToken = await deploy(MockLink__factory);
    await deploy(MockCoordinator__factory, {
      args: [linkToken.address]
    });
  }
};

export default func;
func.tags = ["mock"];
