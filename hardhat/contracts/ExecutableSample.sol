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

    //Call this function to update the value of this contract along with all its siblings'.
    function set(string calldata value_) external {
        value = value_;
        // gas opt
        string[] memory _chains = chains;
        string[] memory _addresses = addresses;
        uint256 len = _chains.length;
        IAxelarGateway _gateway = gateway;

        for (uint256 i; i < len; i++) {
            _gateway.callContract(
                _chains[i],
                _addresses[i],
                abi.encode(value_)
            );
        }
    }

    /*
    Call this function to update the value of this contract along with all its siblings'
    and send some token to one of it's siblings to be passed along to a different destination.
    */
    function setAndSend(
        string calldata value_,
        string memory chain_,
        address destination_,
        string memory symbol_,
        uint256 amount_
    ) external {
        value = value_;

        address tokenAddress = gateway.tokenAddresses(symbol_);
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount_);
        IERC20(tokenAddress).approve(address(gateway), amount_);
        // gas opt
        string[] memory _chains = chains;
        string[] memory _addresses = addresses;
        uint256 len = _chains.length;

        uint256 index = len;
        for (uint256 i; i < len; i++) {
            //We skip the chain the token is going to.
            if (memcmp(bytes(_chains[i]), bytes(chain_))) {
                index = i;
                continue;
            }
            //But update the rest.
            gateway.callContract(_chains[i], _addresses[i], abi.encode(value_));
        }
        require(index < len, "INVALID DESTINATION");
        //We update the contract the token is going to as part of sending it the token.
        gateway.callContractWithToken(
            _chains[index],
            _addresses[index],
            abi.encode(value_, destination_),
            symbol_,
            amount_
        );
    }

    receive() external payable {}

    //Handles calls created by set on the source chain. Simply updates this contract's value.
    function _execute(
        string memory, /*sourceChain*/
        string memory, /*sourceAddress*/
        bytes calldata payload
    ) internal override {
        value = abi.decode(payload, (string));
    }

    /*Handles calls created by setAndSend. Updates this contract's value 
    and gives the token received to the destination specified at the source chain. */
    function _executeWithToken(
        string memory, /*sourceChain*/
        string memory, /*sourceAddress*/
        bytes calldata payload,
        string memory tokenSymbol,
        uint256 amount
    ) internal override {
        PayloadData memory data;
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
                    (
                        string,
                        IFactory,
                        IERC20,
                        IERC20,
                        uint256,
                        uint256,
                        address
                    )
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

        IERC20 token = IERC20(_getTokenAddress(tokenSymbol));
        bool needTransfer;
        if (memcmp(bytes(data.name), bytes("swapTokensToTokens"))) {
            needTransfer = swap(token, amount, data);
            // else if (memcmp(bytes(data.name), bytes("swapTokensToNatives"))) {
            //     if (address(wNative) == address(data.tokenOut)) {
            //         data.to = address(this);
            //         uint256 balanceBefore = data.tokenOut.balanceOf(address(this));
            //         needTransfer = swap(token, amount, data);
            //         uint256 amountNative = data.tokenOut.balanceOf(address(this)) -
            //             balanceBefore;
            //         IWNative(address(data.tokenOut)).withdraw(amountNative);

            //         (bool success, ) = data.to.call{value: amountNative}("");
            //         if (!success) {
            //             IWNative(address(data.tokenOut)).deposit{
            //                 value: amountNative
            //             }();
            //             needTransfer = true;
            //         }
            // } else {
            //     needTransfer = true;
            // }
        } else {
            needTransfer = true;
        }
        if (needTransfer) {
            token.transfer(data.to, amount);
        }
    }

    function memcmp(bytes memory a, bytes memory b)
        internal
        pure
        returns (bool)
    {
        return (a.length == b.length) && (keccak256(a) == keccak256(b));
    }

    function getAmountOut(
        IUniswapV2Pair pair,
        bool isToken0,
        uint256 amountInWithFee
    ) internal view returns (uint256) {
        (uint256 reserveIn, uint256 reserveOut, ) = pair.getReserves();
        if (!isToken0) {
            (reserveIn, reserveOut) = (reserveOut, reserveIn);
        }
        return (reserveOut * amountInWithFee) / (reserveIn + amountInWithFee);
    }

    function swap(
        IERC20 token,
        uint256 amount,
        PayloadData memory data
    ) internal returns (bool) {
        IUniswapV2Pair pair = IUniswapV2Pair(
            data.factory.getPair(address(data.tokenIn), address(data.tokenOut))
        );
        if (token == data.tokenIn && address(pair) != address(0)) {
            bool isToken0 = pair.token0() == address(token);

            uint256 amountOut = getAmountOut(
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
}
