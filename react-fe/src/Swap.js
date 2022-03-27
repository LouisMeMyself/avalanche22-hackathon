import { SwitchVerticalIcon as SwitchVerticalIconSolid } from "@heroicons/react/solid";
import { useState } from "react";

import TwoFrames from "./TwoFrames";
import TokenInput from "./TokenInput";

export default function Swap({ tokenAmount, wNativeAmount, swapFunction }) {
  const [selectedChainFrom, setSelectedChainFrom] = useState({
    id: -1,
    name: "Select a Chain",
  });
  const [selectedChainTo, setSelectedChainTo] = useState({
    id: -1,
    name: "Select a Chain",
  });
  const [selectedTokenFrom, setSelectedTokenFrom] = useState({
    id: -1,
    name: "Select a Token",
  });
  const [selectedTokenTo, setSelectedTokenTo] = useState({
    id: -1,
    name: "Select a Token",
  });
  const [tokenInAmount, setTokenInAmount] = useState("");

  const invertValues = () => {
    const memChainFrom = selectedChainFrom;
    setSelectedChainFrom(selectedChainTo);
    setSelectedChainTo(memChainFrom);
    const memTokenFrom = selectedTokenFrom;
    setSelectedTokenFrom(selectedTokenTo);
    setSelectedTokenTo(memTokenFrom);
  };

  let balance =
    selectedTokenFrom.id !== -1
      ? selectedTokenFrom.name === "UST"
        ? Number(tokenAmount.amount.toString()) / 10 ** tokenAmount.decimals
        : Number(wNativeAmount.amount.toString()) / 10 ** tokenAmount.decimals
      : "";

  const validateSwap = () => {
    swapFunction(selectedTokenFrom.name, selectedTokenTo.name, "UST", tokenInAmount);
  };

  return (
    <>
      <div className="min-h-full flex flex-col justify-center pt-12 sm:px-6 lg:px-8">
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white pt-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
              <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                Cross Chain Swap
              </h2>
            </div>
            <div className="space-y-6 py-12">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  From
                </label>
                <TwoFrames
                  selectedChain={selectedChainFrom}
                  setSelectedChain={setSelectedChainFrom}
                  selectedToken={selectedTokenFrom}
                  setSelectedToken={setSelectedTokenFrom}
                />
              </div>
              <div className="min-h-full flex justify-center">
                <button
                  type="button"
                  className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-gray-400 hover:bg-gray-500"
                  onClick={invertValues}
                >
                  <SwitchVerticalIconSolid
                    className="h-5 w-5"
                    aria-hidden="true"
                  />
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  To
                </label>
                <TwoFrames
                  selectedChain={selectedChainTo}
                  setSelectedChain={setSelectedChainTo}
                  selectedToken={selectedTokenTo}
                  setSelectedToken={setSelectedTokenTo}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Amount: {balance}
                </label>
                <TokenInput
                  amount={tokenInAmount}
                  setAmount={setTokenInAmount}
                />
              </div>

              <div className="pt-8">
                <button
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={validateSwap}
                >
                  Swap
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
