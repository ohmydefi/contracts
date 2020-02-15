pragma solidity 0.5.11;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";

contract IWETH is ERC20 {
    event Deposit(address indexed sender, uint256 amount);
    event Withdrawal(address indexed recipient, uint256 amount);

    function deposit() public payable;
    function withdraw(uint256 amount) public;
    function withdraw(uint256 amount, address payable user) public;
}

//contract WETH is IWETH {
//    string public name = "Wrapped Ether";
//    string public symbol = "WETH";
//    uint8  public decimals = 18;
//
//    function deposit() public payable {
//        _mint(msg.sender, msg.value);
//        emit Deposit(msg.sender, msg.value);
//    }
//
//    function withdraw(uint256 amount) public {
//        require(balanceOf(msg.sender) >= amount);
//        address payable recipient = msg.sender;
//        _burn(msg.sender, amount);
//        recipient.transfer(amount);
//        emit Withdrawal(recipient, amount);
//    }
//
//    function withdraw(uint256 amount, address payable recipient) public {
//        require(balanceOf(msg.sender) >= amount);
//        recipient.transfer(amount);
//        _burn(msg.sender, amount);
//        emit Withdrawal(recipient, amount);
//    }
//}
