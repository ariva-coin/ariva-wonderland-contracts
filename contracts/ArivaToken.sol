// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ArivaToken is ERC20 {
    constructor() ERC20("ArivaToken", "ARV") {
        _mint(msg.sender, 1000000000 * 10 ** 8);
    }

    function mint() external {
        _mint(msg.sender, 1000000 * 10 ** 8);
    }

    function decimals() public view  override returns (uint8) {
        return 8;
    }
}
