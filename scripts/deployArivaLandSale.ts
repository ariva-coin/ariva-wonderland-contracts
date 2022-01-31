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
  const param = [
    params.land,
    params.arv,
    params.metaTransactionContract,
    params.admin,
    params.saleWallet,
    Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
  ];

  // construction params

  const ArivaLandSale: ContractFactory = await ethers.getContractFactory("ArivaLandSale");
  const sale: Contract = await ArivaLandSale.deploy(...param);
  await sale.deployed();

  console.log("LandSale deployed to:", sale.address);

  await waitSeconds(25);

  await hre.run("verify:verify", {
    address: sale.address,
    contract: "contracts/LandSale/ArivaLandSale.sol:ArivaLandSale",
    constructorArguments: param,
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
