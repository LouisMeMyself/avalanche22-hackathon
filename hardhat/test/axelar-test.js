"use strict";
const { createNetwork, relay } = require("@axelar-network/axelar-local-dev");
const { BigNumber } = require("@ethersproject/bignumber/lib/bignumber");
const { ethers } = require("hardhat");

const ExecutableSample = require("../artifacts/contracts/ExecutableSample.sol/ExecutableSample.json");
const UniswapV2Factory = require("../artifacts/contracts/uniswap-v2/UniswapV2Factory.sol/UniswapV2Factory.json");
const WNative = require("../artifacts/contracts/WNative.sol/WNative.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const deployContract = async (
  wallet,
  contractJson,
  args = [],
  options = {}
) => {
  const factory = new ethers.ContractFactory(
    contractJson.abi,
    contractJson.bytecode,
    wallet
  );
  const contract = await factory.deploy(...args, { ...options });
  await contract.deployed();
  return contract;
};

const createNativePairAndAddLiquidity = async (
  wallet,
  factory,
  wNative,
  nativeAmount,
  token,
  tokenAmount
) => {
  console.log("Creating pair");
  await (
    await factory.connect(wallet).createPair(wNative.address, token.address)
  ).wait();
  const pairAddress = await factory.getPair(wNative.address, token.address);

  const pair = await ethers.getContractAt("UniswapV2Pair", pairAddress);

  await (
    await token.connect(wallet).transfer(pair.address, tokenAmount)
  ).wait();

  await (await wNative.connect(wallet).deposit({ value: nativeAmount })).wait();
  await (
    await wNative.connect(wallet).transfer(pair.address, nativeAmount)
  ).wait();

  console.log("Minting LPs");
  await (await pair.connect(wallet).mint(wallet.address)).wait();

  return pair;
};

(async () => {
  // Create two chains and get a funded user for each
  const chain1 = await createNetwork();
  const [user1] = chain1.userWallets;
  const chain2 = await createNetwork({ seed: "chain2" });
  const [user2] = chain2.userWallets;

  console.log("Deploying uniswap factory to chain1");
  const factory1 = await deployContract(user1, UniswapV2Factory, [
    user1.address,
  ]);
  console.log("Deploying uniswap factory to chain2");
  const factory2 = await deployContract(user2, UniswapV2Factory, [
    user2.address,
  ]);

  console.log("Deploying wnative to chain1");
  const wNative1 = await deployContract(user1, WNative);
  console.log("Deploying wnative to chain2");
  const wNative2 = await deployContract(user2, WNative);

  // Deploy our IAxelarExecutable contracts
  const ex1 = await deployContract(user1, ExecutableSample, [
    chain1.gateway.address,
    wNative1.address,
  ]);
  const ex2 = await deployContract(user2, ExecutableSample, [
    chain2.gateway.address,
    wNative2.address,
  ]);

  // Inform our exeuctables about each other.
  await (await ex1.connect(user1).addSibling(chain2.name, ex2.address)).wait();
  await (await ex2.connect(user2).addSibling(chain1.name, ex1.address)).wait();

  // Get some UST on chain1.
  await chain1.giveToken(user1.address, "UST", 500000000000);
  await chain2.giveToken(user2.address, "UST", 300000000000);

  const pair1 = await createNativePairAndAddLiquidity(
    user1,
    factory1,
    wNative1,
    ethers.utils.parseEther("3"),
    chain1.ust,
    300000000000
  );
  const pair2 = await createNativePairAndAddLiquidity(
    user2,
    factory2,
    wNative2,
    ethers.utils.parseEther("3"),
    chain2.ust,
    300000000000
  );

  // This is used for logging.
  const print = async () => {
    const provider1 = chain1.provider;
    const provider2 = chain2.provider;

    console.log(
      `chain1 user has ${await chain1.ust.balanceOf(
        user1.address
      )} UST, ${await wNative1.balanceOf(
        user1.address
      )} WNative, ${await provider1.getBalance(user1.address)} NATIVE.`
    );
    console.log(
      `chain2 user has ${await chain2.ust.balanceOf(
        user2.address
      )} UST, ${await wNative2.balanceOf(
        user2.address
      )} WNative, ${await provider2.getBalance(user2.address)} NATIVE.`
    );

    const reserves1 = await pair1.connect(user1).getReserves();
    console.log(`chain1 pair reserves (${reserves1[0]}, ${reserves1[1]})`);
    const reserves2 = await pair2.connect(user2).getReserves();
    console.log(`chain2 pair reserves (${reserves2[0]}, ${reserves2[1]})`);
    console.log(
      `ex1: ${await wNative1.balanceOf(
        ex1.address
      )} WNATIVE, ${await provider1.getBalance(
        ex1.address
      )} NATIVE, ex2: ${await wNative2.balanceOf(
        ex2.address
      )} WNATIVE, ${await provider2.getBalance(ex2.address)} NATIVE`
    );
  };

  console.log("--- Initially ---");
  await print();

  await (
    await chain1.ust
      .connect(user1)
      .approve(chain1.gateway.address, 200_000_000_000)
  ).wait();
  const payload = ethers.utils.defaultAbiCoder.encode(
    [
      "string",
      "address",
      "address",
      "address",
      "uint256",
      "uint256",
      "address",
    ],
    [
      "swapTokensToNatives",
      factory2.address,
      chain2.ust.address,
      wNative2.address,
      "0",
      "9970",
      user2.address,
    ]
  );
  await (
    await chain1.gateway
      .connect(user1)
      .callContractWithToken(
        chain2.name,
        ex2.address,
        payload,
        "UST",
        200_000_000_000
      )
  ).wait();
  await sleep(2000);
  await relay();
  console.log("--- Crosschain swap UST -> WNATIVE ---");
  await print();
})();
