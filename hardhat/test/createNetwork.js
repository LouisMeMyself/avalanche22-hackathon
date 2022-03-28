const { createNetwork, relay } = require("@axelar-network/axelar-local-dev")
const { outputJsonSync } = require("fs-extra")
const { ethers } = require("hardhat")

const ExecutableSample = require("../artifacts/contracts/ExecutableSample.sol/ExecutableSample.json")
const UniswapV2Factory = require("../artifacts/contracts/uniswap-v2/UniswapV2Factory.sol/UniswapV2Factory.json")
const WNative = require("../artifacts/contracts/WNative.sol/WNative.json")

const setJSON = (data, name) => {
  outputJsonSync(name, data, {
    spaces: 2,
    EOL: "\n",
  })
}

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
  )
  const contract = await factory.deploy(...args, { ...options })
  await contract.deployed()
  return contract
}

const createNativePairAndAddLiquidity = async (
  wallet,
  factory,
  wNative,
  nativeAmount,
  token,
  tokenAmount
) => {
  console.log("Creating pair")
  await (
    await factory.connect(wallet).createPair(wNative.address, token.address)
  ).wait()
  const pairAddress = await factory.getPair(wNative.address, token.address)

  const pair = await ethers.getContractAt("UniswapV2Pair", pairAddress)

  await (await token.connect(wallet).transfer(pair.address, tokenAmount)).wait()

  await (await wNative.connect(wallet).deposit({ value: nativeAmount })).wait()
  await (
    await wNative.connect(wallet).transfer(pair.address, nativeAmount)
  ).wait()

  console.log("Minting LPs")
  await (await pair.connect(wallet).mint(wallet.address)).wait()

  return pair
}

;(async () => {
  // Create an Axelar network and serve it at port 8501
  const chain1 = await createNetwork({
    port: 8501,
    seed: "1",
  })

  const chain2 = await createNetwork({
    port: 8502,
    seed: "2",
  })

  setJSON(chain1.getInfo(), "./chain1.json")
  setJSON(chain2.getInfo(), "./chain2.json")

  let lock = false
  setInterval(async () => {
    if (lock) return
    lock = true
    await relay()
    lock = false
  }, 1000)

  const args = process.argv.slice(2)
  if (args && args.length === 0) return

  const address = args[0]
  console.log(`Giving 1 ETH and 1000 UST to ${address} on both Chains...`)
  const [user1] = chain1.userWallets
  await (
    await user1.sendTransaction({
      to: address,
      value: BigInt(1e18),
    })
  ).wait()
  await chain1.giveToken(address, "UST", BigInt(100e9))
  await chain1.giveToken(user1.address, "UST", BigInt(100e9))
  const [user2] = chain2.userWallets
  await (
    await user2.sendTransaction({
      to: address,
      value: BigInt(1e18),
    })
  ).wait()
  await chain2.giveToken(address, "UST", BigInt(100e9))
  await chain2.giveToken(user2.address, "UST", BigInt(100e9))

  console.log("Deploying uniswap factory to chain1")
  const factory1 = await deployContract(user1, UniswapV2Factory, [
    user1.address,
  ])
  console.log("Deploying uniswap factory to chain2")
  const factory2 = await deployContract(user2, UniswapV2Factory, [
    user2.address,
  ])

  console.log("Deploying wnative to chain1")
  const wNative1 = await deployContract(user1, WNative)
  console.log("Deploying wnative to chain2")
  const wNative2 = await deployContract(user2, WNative)

  const ex1 = await deployContract(user1, ExecutableSample, [
    chain1.gateway.address,
    wNative1.address,
  ])
  const ex2 = await deployContract(user2, ExecutableSample, [
    chain2.gateway.address,
    wNative2.address,
  ])

  // Inform our exeuctables about each other.
  await (await ex1.connect(user1).addSibling(chain2.name, ex2.address)).wait()
  await (await ex2.connect(user2).addSibling(chain1.name, ex1.address)).wait()

  const pair1 = await createNativePairAndAddLiquidity(
    user1,
    factory1,
    wNative1,
    BigInt(1e18),
    chain1.ust,
    BigInt(100e9)
  )
  const pair2 = await createNativePairAndAddLiquidity(
    user2,
    factory2,
    wNative2,
    BigInt(1e18),

    chain2.ust,
    BigInt(100e9)
  )

  const reserves1 = await pair1.connect(user1).getReserves()
  console.log(
    `chain1 pair (${pair1.address}) reserves (${reserves1[0]}, ${reserves1[1]})`
  )
  console.log(
    `chain1 tokens: UST (${chain1.ust.address}), WNATIVE (${wNative1.address})`
  )
  console.log(
    `chain1 (${chain1.name}): gateway (${chain1.gateway.address}), ex (${ex1.address}), factory (${factory1.address})`
  )

  console.log("")
  const reserves2 = await pair2.connect(user2).getReserves()
  console.log(
    `chain2 pair (${pair2.address}) reserves (${reserves2[0]}, ${reserves2[1]})`
  )
  console.log(
    `chain2 tokens: UST (${chain2.ust.address}), WNATIVE (${wNative2.address})`
  )
  console.log(
    `chain2 (${chain2.name}): gateway (${chain2.gateway.address}), ex (${ex2.address}), factory (${factory2.address})`
  )

  console.log("Done!")
})()
