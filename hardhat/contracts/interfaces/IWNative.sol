// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IWNative is IERC20 {
    function deposit() external payable;

    function withdraw(uint256) external;
}
