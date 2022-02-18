import { TestToken, Land, ArvLandSale } from "./../../typechain";
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

describe("ArvLandSale", function () {
  let token: TestToken;
  let land: Land;
  let arvLandSale: ArvLandSale;

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

    const TestTokenArtifact: Artifact = await hre.artifacts.readArtifact("TestToken");
    token = <TestToken>await deployContract(owner, TestTokenArtifact);

    const LandArtifact = await hre.artifacts.readArtifact("Land");
    land = <Land>await deployContract(owner, LandArtifact, [ZERO_ADDRESS, admin.address]);

    timestamp = await getLatestBlockTimestamp();
    startTime = timestamp + 200;

    const ArvLandSaleArtifact = await hre.artifacts.readArtifact("ArvLandSale");
    arvLandSale = <ArvLandSale>(
      await deployContract(owner, ArvLandSaleArtifact, [
        land.address,
        token.address,
        ZERO_ADDRESS,
        admin.address,
        wallet.address,
        startTime,
      ])
    );

    // transfer tokens to users
    await token.transfer(tester1.address, ether(50));
    await token.transfer(tester2.address, ether(50));
    await token.transfer(tester3.address, ether(50));

    // approve
    await token.connect(tester1).approve(arvLandSale.address, ether(10000));
    await token.connect(tester2).approve(arvLandSale.address, ether(10000));
    await token.connect(tester3).approve(arvLandSale.address, ether(10000));
  });

  describe("mint some Quads to sale contract", function () {
    it("set Minter", async () => {
      await expect(land.connect(tester1).setMinter(minter.address, true)).to.be.revertedWith(
        "only admin is allowed to add minters",
      );
      await land.connect(admin).setMinter(minter.address, true);
    });

    it("mint some Quads", async () => {
      await land.connect(minter).mintQuad(arvLandSale.address, 1, 1, 1, "0x00");
      await land.connect(minter).mintQuad(arvLandSale.address, 3, 3, 3, "0x00");
      await land.connect(minter).mintQuad(arvLandSale.address, 6, 6, 6, "0x00");
      await land.connect(minter).mintQuad(arvLandSale.address, 12, 12, 12, "0x00");
      await land.connect(minter).mintQuad(arvLandSale.address, 24, 24, 24, "0x00");
    });
  });

  describe("buy Lands", function () {
    it("try to buy and advance time", async () => {
      await expect(arvLandSale.connect(tester1).buyLand(tester2.address, tester1.address, 1, 1, 1)).to.be.revertedWith(
        "Sale is not started",
      );
      timestamp = await getLatestBlockTimestamp();
      await advanceTimeAndBlock(startTime - timestamp + 1);
    });
    it("buy (1,1) land", async () => {
      await expect(arvLandSale.connect(tester1).buyLand(tester2.address, tester1.address, 1, 1, 1)).to.be.revertedWith(
        "not authorized",
      );

      await expect(arvLandSale.connect(tester1).buyLand(tester1.address, tester1.address, 1, 1, 1)).to.be.revertedWith(
        "Not on sale",
      );

      await arvLandSale.connect(admin).setSellQuad(1, 1, 1, parseUnits("540000", 8));
      await arvLandSale.connect(tester1).buyLand(tester1.address, tester1.address, 1, 1, 1);

      expect(await token.balanceOf(wallet.address)).to.equal(parseUnits("540000", 8));
    });
    it("buy (3,3) land", async () => {
      await arvLandSale
        .connect(admin)
        .setSellQuads(
          [3, 6, 12, 24],
          [3, 6, 12, 24],
          [3, 6, 12, 24],
          [parseUnits("5000000", 8), parseUnits("25000000", 8), parseUnits("110000000", 8), parseUnits("500000000", 8)],
        );

      const prices = await arvLandSale.getPrices([3, 6, 12, 24], [3, 6, 12, 24], [3, 6, 12, 24]);
      expect(prices[0]).to.equal(parseUnits("5000000", 8));
      expect(prices[1]).to.equal(parseUnits("25000000", 8));
      expect(prices[2]).to.equal(parseUnits("110000000", 8));
      expect(prices[3]).to.equal(parseUnits("500000000", 8));

      await expect(arvLandSale.connect(tester1).buyLand(tester1.address, tester1.address, 3, 3, 1)).to.be.revertedWith(
        "Not on sale",
      );

      expect(await arvLandSale.getPrice(3, 3, 3)).to.equal(parseUnits("5000000", 8));

      await arvLandSale.connect(tester1).buyLand(tester1.address, tester1.address, 3, 3, 3);

      expect(await arvLandSale.getPrice(3, 3, 3)).to.equal(ZERO);
    });

    it("buy (12,12) land", async () => {
      expect(await arvLandSale.getPrice(12, 12, 12)).to.equal(parseUnits("110000000", 8));

      await arvLandSale.connect(tester2).buyLand(tester2.address, tester2.address, 12, 12, 12);
    });

    it("buy (24,24) land", async () => {
      expect(await arvLandSale.getPrice(24, 24, 24)).to.equal(parseUnits("500000000", 8));
      await arvLandSale.connect(tester3).buyLand(tester3.address, tester3.address, 24, 24, 24);
    });

    it("withdrawQuad", async () => {
      await arvLandSale.connect(admin).withdrawQuad(6, 6, 6);
      await expect(arvLandSale.connect(admin).withdrawQuad(6, 6, 6)).to.be.revertedWith(
        "not owner of all sub quads nor parent quads",
      );
    });
  });
});
