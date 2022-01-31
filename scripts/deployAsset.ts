import { Contract, ContractFactory } from "ethers";
// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre, { ethers } from "hardhat";
import { waitSeconds } from "./utils";
import config from "./config";


async function main(): Promise<void> {
  // Hardhat always runs the compile task when running scripts through it.
  // If this runs in a standalone fashion you may want to call compile manually
  // to make sure everything is compiled
  // await run("compile");

  // We get the contract to deploy
  const params = config.bsct;
  const param = []

  // construction params

  const Asset: ContractFactory = await ethers.getContractFactory("Asset");
  const asset: Contract = await Asset.deploy();
  await asset.deployed();

  console.log("Asset deployed to:", asset.address);

  await waitSeconds(25);

  await hre.run("verify:verify", {
    address: asset.address,
    contract: "contracts/Asset.sol:Asset",
    constructorArguments: [],
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });