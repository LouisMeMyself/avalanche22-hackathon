import "./App.css";
import { useEffect, useState } from "react";
import { ethers } from "ethers";

import ERC20 from "./utils/ERC20.json";
import WNATIVE from "./utils/WNative.json";
import GATEWAY from "./utils/IAxelarGateway.json";

import Swap from "./Swap";

const address = {
  "Chain 1": {
    UST: "0xbd81151c48e30b6b2BCA0F15d4F495d76711bcA5",
    WNATIVE: "0x07B0610F0c9F9C4Fe4E4d8cC7fEEdBBe24C90008",
    gateway: "0x35DD7542dcaf27c275651c86a2B066e09d5d77e1",
    ex: "0x510134513E3Df65851a72268468Bf1d363b1Ced9",
    factory: "0x33001Ab4453554Bad6387C843457b2519e7aF558",
  },
  "Chain 2": {
    UST: "0x7Bb875B51D280dc75953A27f2C07Dd52cB979D95",
    WNATIVE: "0x0634361AFd07785d82b4Dfb43159A30355A27c9a",
    gateway: "0xf2988652b06526A26377eB107009211c7e7329d4",
    ex: "0xe2C420fA038a09e19EAe1eC03A4dbA0ced604dBE",
    factory: "0x818c554B468888Ee531A60c889e3849a27F533aA",
  },
};

const getChainName = (id) => {
  switch (id) {
    case 2500:
      return "Chain 1";
    case 2501:
      return "Chain 2";
    default:
      return "Wrong Network";
  }
};

function App() {
  const [walletAddress, setWalletAddress] = useState("");
  const [provider, setProvider] = useState("");
  const [chainName, setChainName] = useState("");
  const [token, setToken] = useState({ amount: 0, decimals: 9 });
  const [wNative, setWNative] = useState({ amount: 0, decimals: 18 });
  const [tx, setTx] = useState();
  const [tokenContract, setTokenContract] = useState();
  const [wNativeContract, setWNativeContract] = useState();
  const [gateway, setGateway] = useState();

  let _pollDataInterval;

  async function _manageTx(tx) {
    console.log(tx);
    setTx(tx.hash);

    if (!tx) {
      throw new Error("No tx hash");
    }

    const receipt = await provider.waitForTransaction(tx.hash);
    if (receipt.status === 0) {
      throw new Error("Transaction failed");
    }

    await _updateBalance();
  }

  async function requestAccount() {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        setWalletAddress(accounts[0]);
      } catch (error) {
        console.log("Error connecting...");
      }

      window.ethereum.on("accountsChanged", ([newAddress]) => {
        _stopPollingData();
        if (newAddress === undefined) {
          return _resetState();
        }
        setWalletAddress(newAddress);
      });
    } else {
      alert("Metamask not detected");
    }
  }

  function _startPollingData() {
    _pollDataInterval = setInterval(() => _updateBalance(), 2500);
  }
  async function _updateBalance() {
    try {
      setToken({
        ...token,
        amount: await tokenContract.balanceOf(walletAddress),
      });
      setWNative({
        ...wNative,
        amount: await wNativeContract.balanceOf(walletAddress),
      });
    } catch (e) {
      console.log("Error", e);
    }
  }

  function _stopPollingData() {
    clearInterval(_pollDataInterval);
    _pollDataInterval = undefined;
  }

  // Create a provider to interact with a smart contract
  async function connectWallet() {
    if (typeof window.ethereum !== "undefined") {
      await requestAccount();

      setProvider(new ethers.providers.Web3Provider(window.ethereum));
    }
  }

  const _resetState = () => {
    setWalletAddress("");
    setProvider("");
    setChainName("");
  };

  const _intializeEthers = async (chainName_) => {
    const signer = await provider.getSigner();
    setTokenContract(
      new ethers.Contract(address[chainName_].UST, ERC20.abi, signer)
    );
    setWNativeContract(
      new ethers.Contract(address[chainName_].WNATIVE, WNATIVE.abi, signer)
    );
    setGateway(
      new ethers.Contract(address[chainName_].gateway, GATEWAY.abi, signer)
    );

    _startPollingData();
  };

  async function swapFunction(nameInExt, nameOutExt, name, amount) {
    try {
      const chainExt =
        chainName === "Chain 1"
          ? "Chain 2"
          : chainName === "Chain 2"
          ? "Chain 1"
          : "Error";

      await _manageTx(tokenContract.approve(gateway.address, amount));

      console.log(
        "swapTokensToTokens",
        address[chainExt].factory,
        address[chainExt].UST,
        address[chainExt].WNATIVE,
        "0",
        "9970",
        walletAddress
      );

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
          "swapTokensToTokens",
          address[chainExt].factory,
          nameInExt == "UST"
            ? address[chainExt].UST
            : address[chainExt].WNATIVE,
          nameOutExt == "UST"
            ? address[chainExt].UST
            : address[chainExt].WNATIVE,
          "0",
          "9970",
          walletAddress,
        ]
      );

      const tx_ = gateway.callContractWithToken(
        chainExt,
        address[chainExt].ex,
        payload,
        name,
        amount
      );
      setTx(tx_);
      await _manageTx(tx_);
    } catch (e) {
      console.log(e);
    } finally {
      setTx(undefined);
    }
  }

  useEffect(async () => {
    if (!!provider) {
      try {
        const chainName_ = getChainName((await provider.getNetwork()).chainId);
        setChainName(chainName_);
        _intializeEthers(chainName_);
      } catch (error) {
        console.log(error);
      }
    }
  }, [provider]);

  return (
    <>
      <div>
        {/* Static sidebar for desktop */}
        <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white shadow">
          <div className="flex-1 px-4 flex justify-between">
            <div className="flex-1 flex"></div>
            <div className="ml-4 flex items-center md:ml-6">
              <button
                type="button"
                className="bg-white p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {chainName}
              </button>

              {/* Profile dropdown */}
              <div as="div" className="ml-3 relative">
                <button
                  className="inline-flex items-center px-3.5 py-2 border border-transparent text-sm leading-4 font-medium rounded-full shadow-sm text-black bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  onClick={connectWallet}
                >
                  {walletAddress !== ""
                    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(
                        -4
                      )}`
                    : "Connect your wallet"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <main className="flex-1">
          <div className="py-6">
            <Swap
              tokenAmount={token}
              wNativeAmount={wNative}
              swapFunction={swapFunction}
            />
          </div>
        </main>
      </div>
    </>
  );
}

export default App;
