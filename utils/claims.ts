import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, BigNumberish, Wallet } from "ethers";
import { AbiCoder, solidityKeccak256, splitSignature, toUtf8Bytes } from "ethers/lib/utils";
import { ethers } from "hardhat";

export interface Configuration {
  IssuerPrivateKey: string;
  ContractAddress: string;
  DomainName?: string;
}

export interface Signature {
  v: number;
  r: string;
  s: string;
}

export interface SignedClaim {
  nonce: BigNumberish;
  target: string;
  amount: BigNumberish;
  signature: Signature;
}

export class ClaimsManager {
  config: Configuration;

  constructor(config: Configuration) {
    this.config = config;
  }

  async generate_claim(target: string, amount: number): Promise<SignedClaim> {
    const issuerWallet = new Wallet(this.config.IssuerPrivateKey);
    const nonce: number = Date.now();

    const hash = solidityKeccak256(["uint", "address", "uint"], [nonce, target, amount]);
    const signature = await issuerWallet.signMessage(ethers.utils.arrayify(hash));

    const { v, r, s } = splitSignature(signature);

    return {
      signature: { v, r, s },
      target,
      amount,
      nonce,
    };
  }
}

export async function generate_claim(
  issuerWallet: SignerWithAddress,
  target: string,
  amount: BigNumberish,
  nonce: BigNumberish,
): Promise<SignedClaim> {
  // const nonce: BigNumberish = Date.now();
  amount = BigNumber.from(amount);
  const hash = solidityKeccak256(["uint", "address", "uint"], [nonce, target, amount]);
  const signature = await issuerWallet.signMessage(ethers.utils.arrayify(hash));

  const { v, r, s } = splitSignature(signature);

  return {
    signature: { v, r, s },
    target,
    amount,
    nonce,
  };
}
