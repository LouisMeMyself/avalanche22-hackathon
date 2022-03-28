// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import "@axelar-network/axelar-cgp-solidity/src/interfaces/IAxelarExecutable.sol";
import "./uniswap-v2/interfaces/IUniswapV2Pair.sol";
import "./interfaces/IWNative.sol";

interface IFactory {
    function getPair(address tokenA, address tokenB)
        external
        view
        returns (address pair);
}

contract ExecutableSample is IAxelarExecutable {
    string public value;
    string[] public chains;
    string[] public addresses;
    IWNative public wNative;

    struct PayloadData {
        string name;
        IFactory factory;
        IERC20 tokenIn;
        IERC20 tokenOut;
        uint256 minAmountOut;
        uint256 feesBp;
        address to;
    }

    constructor(address gateway_, IWNative wNative_)
        IAxelarExecutable(gateway_)
    {
        wNative = wNative_;
    }

    //Call this function to get the length of chains / addresses arrays.
    function chainsLen() external view returns (uint256) {
        return chains.length;
    }

    //Call this function on setup to tell this contract who it's sibling contracts are.
    function addSibling(string calldata chain_, string calldata address_)
        external
    {
        chains.push(chain_);
        addresses.push(address_);
    }

    receive() external payable {}

    /*Handles calls created by setAndSend. Updates this contract's value 
and gives the token received to the destination specified at the source chain. */
    function _executeWithToken(
        string memory, /*sourceChain*/
        string memory, /*sourceAddress*/
        bytes calldata payload,
        string memory tokenSymbol,
        uint256 amount
    ) internal override {
        PayloadData memory data = _getPayloadData(payload);

        IERC20 token = IERC20(_getTokenAddress(tokenSymbol));
        bool needTransfer;
        if (_memcmp(bytes(data.name), bytes("swapTokensToTokens"))) {
            needTransfer = _swap(token, amount, data);
        } else if (_memcmp(bytes(data.name), bytes("swapTokensToNatives"))) {
            if (address(wNative) == address(data.tokenOut)) {
                address user = data.to;
                data.to = address(this);
                uint256 balanceBefore = data.tokenOut.balanceOf(address(this));
                needTransfer = _swap(token, amount, data);
                if (!needTransfer) {
                    uint256 amountNative = data.tokenOut.balanceOf(
                        address(this)
                    ) - balanceBefore;
                    IWNative(address(data.tokenOut)).withdraw(amountNative);

                    (bool success, ) = user.call{value: amountNative}("");
                    if (!success) {
                        IWNative(address(data.tokenOut)).deposit{
                            value: amountNative
                        }();
                        needTransfer = true;
                    }
                }
            } else {
                needTransfer = true;
            }
        } else {
            needTransfer = true;
        }
        if (needTransfer) {
            token.transfer(data.to, amount);
        }
    }

    function _swap(
        IERC20 token,
        uint256 amount,
        PayloadData memory data
    ) private returns (bool) {
        IUniswapV2Pair pair = IUniswapV2Pair(
            data.factory.getPair(address(data.tokenIn), address(data.tokenOut))
        );
        if (token == data.tokenIn && address(pair) != address(0)) {
            bool isToken0 = pair.token0() == address(token);

            uint256 amountOut = _getAmountOut(
                pair,
                isToken0,
                (amount * data.feesBp) / 10_000
            );

            if (amountOut <= data.minAmountOut) {
                return true;
            } else {
                token.transfer(address(pair), amount);
                if (isToken0) {
                    pair.swap(0, amountOut, data.to, "");
                } else {
                    pair.swap(amountOut, 0, data.to, "");
                }
            }
        } else {
            return true;
        }
        return false;
    }

    function _memcmp(bytes memory a, bytes memory b)
        private
        pure
        returns (bool)
    {
        return (a.length == b.length) && (keccak256(a) == keccak256(b));
    }

    function _getAmountOut(
        IUniswapV2Pair pair,
        bool isToken0,
        uint256 amountInWithFee
    ) private view returns (uint256) {
        (uint256 reserveIn, uint256 reserveOut, ) = pair.getReserves();
        if (!isToken0) {
            (reserveIn, reserveOut) = (reserveOut, reserveIn);
        }
        return (reserveOut * amountInWithFee) / (reserveIn + amountInWithFee);
    }

    function _getPayloadData(bytes calldata payload)
        private
        returns (PayloadData memory data)
    {
        (
            string memory name,
            IFactory factory,
            IERC20 tokenIn,
            IERC20 tokenOut,
            uint256 minAmountOut,
            uint256 feesBp,
            address to
        ) = abi.decode(
                payload,
                (string, IFactory, IERC20, IERC20, uint256, uint256, address)
            );
        data = PayloadData(
            name,
            factory,
            tokenIn,
            tokenOut,
            minAmountOut,
            feesBp,
            to
        );
    }
}
