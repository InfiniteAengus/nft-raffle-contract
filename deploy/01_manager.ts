import { DeployFunction } from "hardhat-deploy/types";
import { Manager__factory, MockCoordinator__factory, MockLink__factory, Vault__factory } from "../types";
import { Ship } from "../utils";
import { supportChains } from "./config/chains";
import { chainlinkConfigs } from "./config/contracts";
import { constants } from "ethers";
import { parseEther } from "ethers/lib/utils";

const func: DeployFunction = async (hre) => {
  const { deploy, connect, accounts } = await Ship.init(hre);

  let config;

  if (hre.network.tags.live) {
    const networkName = hre.network.name;
    const chainId = supportChains[networkName];
    if (!chainId) {
      throw Error("Unsupported network");
    }

    config = chainlinkConfigs[chainId];
  } else {
    const linkToken = await connect(MockLink__factory);
    const vrfCoordinate = await connect(MockCoordinator__factory);

    config = {
      linkToken: linkToken.address,
      vrfCoordinate: vrfCoordinate.address,
      keyHash: constants.HashZero,
      fee: parseEther("0.1"),
    };
  }

  const vault = await deploy(Vault__factory, {
    args: [accounts.signer.address],
  });

  await deploy(Manager__factory, {
    args: [
      vault.address,
      accounts.signer.address,
      config.vrfCoordinate,
      config.linkToken,
      config.keyHash,
      config.fee,
    ],
  });
};

export default func;
func.tags = ["manager"];
func.dependencies = ["mock"];
