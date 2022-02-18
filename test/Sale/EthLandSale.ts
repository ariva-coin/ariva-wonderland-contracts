import { TestToken, Land, EthLandSale } from "./../../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import { deployContract, solidity } from "ethereum-waffle";
import hre, { ethers, upgrades } from "hardhat";
import { Artifact } from "hardhat/types";
import {
  advanceBlock,
  advanceTimeAndBlock,
  ether,
  wei,
  ZERO,
  getLatestBlockTimestamp,
  getLatestBlockNumber,
  revertEvm,
  getSnapShot,
  ZERO_ADDRESS,
} from "../utils";
import { parseUnits } from "ethers/lib/utils";

const { expect } = chai;

chai.use(solidity);

describe("EthLandSale", function () {
  let token: TestToken;
  let land: Land;
  let ethLandSale: EthLandSale;

  let owner: SignerWithAddress;
  let tester1: SignerWithAddress;
  let tester2: SignerWithAddress;
  let tester3: SignerWithAddress;
  let minter: SignerWithAddress;
  let wallet: SignerWithAddress;
  let admin: SignerWithAddress;
  let startTime: number;
  let timestamp: number;

  before(async function () {
    const signers: SignerWithAddress[] = await hre.ethers.getSigners();

    owner = signers[0];
    tester1 = signers[1];
    tester2 = signers[2];
    tester3 = signers[3];
    minter = signers[4];
    wallet = signers[5];
    admin = signers[6];

    const LandArtifact = await hre.artifacts.readArtifact("Land");
    land = <Land>await deployContract(owner, LandArtifact, [ZERO_ADDRESS, admin.address]);

    timestamp = await getLatestBlockTimestamp();
    startTime = timestamp + 200;

    const EthLandSaleArtifact = await hre.artifacts.readArtifact("EthLandSale");
    ethLandSale = <EthLandSale>(
      await deployContract(owner, EthLandSaleArtifact, [
        land.address,
        ZERO_ADDRESS,
        admin.address,
        wallet.address,
        startTime,
      ])
    );
  });

  describe("mint some Quads to sale contract", function () {
    it("set Minter", async () => {
      await expect(land.connect(tester1).setMinter(minter.address, true)).to.be.revertedWith(
        "only admin is allowed to add minters",
      );
      await land.connect(admin).setMinter(minter.address, true);
    });

    it("mint some Quads", async () => {
      await land.connect(minter).mintQuad(ethLandSale.address, 1, 1, 1, "0x00");
      await land.connect(minter).mintQuad(ethLandSale.address, 3, 3, 3, "0x00");
      await land.connect(minter).mintQuad(ethLandSale.address, 6, 6, 6, "0x00");
      await land.connect(minter).mintQuad(ethLandSale.address, 12, 12, 12, "0x00");
      await land.connect(minter).mintQuad(ethLandSale.address, 24, 24, 24, "0x00");
    });
  });

  describe("check prices", function () {
    it("check basic price", async () => {
      expect(await ethLandSale.getPrice(1)).to.equal(ether(0.1));
      expect(await ethLandSale.getPrice(3)).to.equal(ether(1));
      expect(await ethLandSale.getPrice(6)).to.equal(ether(4.5));
      expect(await ethLandSale.getPrice(12)).to.equal(ether(20));
      expect(await ethLandSale.getPrice(24)).to.equal(ether(90));
    });

    it("check startTime", async () => {
      expect(await ethLandSale.startTime()).to.equal(wei(startTime));
    });
  });

  describe("buy Lands", function () {
    it("try to buy and advance time", async () => {
      await expect(ethLandSale.connect(tester1).buyLand(tester2.address, tester1.address, 1, 1, 1)).to.be.revertedWith(
        "Sale is not started",
      );
      timestamp = await getLatestBlockTimestamp();
      await advanceTimeAndBlock(startTime - timestamp + 1);
    });
    it("buy (1,1) land", async () => {
      await expect(ethLandSale.connect(tester1).buyLand(tester2.address, tester1.address, 1, 1, 1)).to.be.revertedWith(
        "not authorized",
      );
      await expect(ethLandSale.connect(tester1).buyLand(tester1.address, tester1.address, 1, 1, 2)).to.be.revertedWith(
        "Price is not set yet",
      );

      await expect(ethLandSale.connect(tester1).buyLand(tester1.address, tester1.address, 1, 1, 1)).to.be.revertedWith(
        "Not on sale",
      );

      await ethLandSale.connect(admin).setSellQuad(1, 1, 1, true);

      const prevBalance = await ethers.provider.getBalance(wallet.address);

      await ethLandSale.connect(tester1).buyLand(tester1.address, tester1.address, 1, 1, 1, { value: ether(0.1) });

      const afterBalance = await ethers.provider.getBalance(wallet.address);

      expect(afterBalance.sub(prevBalance)).to.equal(ether(0.1));
    });
    it("buy (3,3) land", async () => {
      await ethLandSale.connect(admin).setSellQuads([3, 6, 12, 24], [3, 6, 12, 24], [3, 6, 12, 24], true);

      await expect(ethLandSale.connect(tester1).buyLand(tester1.address, tester1.address, 3, 3, 1)).to.be.revertedWith(
        "Not on sale",
      );
      await ethLandSale.connect(tester1).buyLand(tester1.address, tester1.address, 3, 3, 3, { value: ether(1) });

      expect(await ethLandSale.isQuadSelling(3, 3, 3)).to.equal(false);
    });

    it("buy (12,12) land", async () => {
      await ethLandSale.connect(tester2).buyLand(tester2.address, tester2.address, 12, 12, 12, { value: ether(20) });

      expect(await ethLandSale.isQuadSelling(12, 12, 12)).to.equal(false);
    });

    it("buy (24,24) land", async () => {
      await ethLandSale.connect(tester3).buyLand(tester3.address, tester3.address, 24, 24, 24, { value: ether(90) });

      expect(await ethLandSale.isQuadSelling(12, 12, 12)).to.equal(false);
    });

    it("withdrawQuad", async () => {
      await ethLandSale.connect(admin).withdrawQuad(6, 6, 6);
      await expect(ethLandSale.connect(admin).withdrawQuad(6, 6, 6)).to.be.revertedWith(
        "not owner of all sub quads nor parent quads",
      );
    });
  });
});
