const { TestHelper } = require("@openzeppelin/cli");
const { Contracts, ZWeb3 } = require("@openzeppelin/upgrades");
const BN = require("bn.js");

ZWeb3.initialize(web3.currentProvider);

const CallETH = Contracts.getFromLocal("CallETH");
const StandaloneERC20 = Contracts.getFromNodeModules(
  "@openzeppelin/contracts-ethereum-package",
  "StandaloneERC20"
);

require("chai").should();

contract("CallETH", function(accounts) {
  const ethAddress = '0x0000000000000000000000000000000000000000'
  let mockStrikeAsset;
  let calleth;

  let sellerAddress;
  let buyerAddress;
  const strikePriceAmount = (270e18).toString();

  beforeEach(async function() {
    this.project = await TestHelper();

    sellerAddress = accounts[0];
    buyerAddress = accounts[1];
    anotherRandomAddress = accounts[2];

    mockStrikeAsset = await this.project.createProxy(StandaloneERC20, {
      initMethod: "initialize",
      initArgs: [
        "Fake StrikeAsset",
        "StrikeAsset",
        18,
        strikePriceAmount,
        sellerAddress,
        [],
        []
      ]
    });

    calleth = await this.project.createProxy(CallETH, {
      initMethod: "initializeInTestMode",
      initArgs: [
        "cohETH:STRIKE",
        "COH:ETH:STRIKE",
        ethAddress,
        mockStrikeAsset.address,
        270000000,
        6
      ]
    });
  });

  async function checkBalances(account, options, strikeAsset, underlyingAsset) {
    if (options !== null) {
      const optionsBalance = await calleth.methods.balanceOf(account).call();
      optionsBalance.should.be.equal(options);
    }

    if (strikeAsset !== null) {
      const strikeAssetBalance = await mockStrikeAsset.methods
        .balanceOf(account)
        .call();
      strikeAssetBalance.should.be.equal(strikeAsset);
    }

    if (underlyingAsset !== null) {
      const underlyingBalance = await ZWeb3.getBalance(account);
      underlyingBalance.should.be.equal(underlyingAsset);
    }

    // if (underlyingAsset !== null) {
    //   const daiBalance = await mockUnderlyingAsset.methods.balanceOf(account).call();
    //   daiBalance.should.be.equal(underlyingAsset);
    // }
  }

  async function txCost(tx) {
    try {
      const txHash = tx.transactionHash;
      const gasUsed = new BN(tx.gasUsed);
      const txInfo = await ZWeb3.getTransaction(txHash);
      const gasPrice = new BN(txInfo.gasPrice);
      return gasUsed.mul(gasPrice);
    } catch (err) {
      return err;
    }
  }

  async function mintOptions() {
    await checkBalances(sellerAddress, "0", (270e18).toString(), null);
    // await checkBalances(daiHolder, "0", "0", "100000000000000000000");

    const currentETHAmount = await ZWeb3.getBalance(sellerAddress);
    await calleth.methods
      .mint()
      .send({ from: sellerAddress, value: (1e18).toString() });

    await checkBalances(
      sellerAddress,
      (1e18).toString(),
      (270e18).toString(),
      null
    );
    // await checkBalances(daiHolder, "0", "0", "100000000000000000000");
  }

  async function mintOptionsDecimals() {
    await checkBalances(sellerAddress, "0", (270e18).toString(), null);
    // await checkBalances(daiHolder, "0", "0", "100000000000000000000");

    await calleth.methods
      .mint()
      .send({ from: sellerAddress, value: (1e17).toString() });

    await checkBalances(
      sellerAddress,
      (1e17).toString(),
      (270e18).toString(),
      null
    );
    // await checkBalances(daiHolder, "0", "0", "100000000000000000000");
  }

  describe("general checks", function() {
    it("should have 18 fixed decimals", async function() {
      const decimals = await calleth.methods.decimals().call();
      decimals.should.be.equals("18");
    });
  });

  describe("before expiration", function() {
    afterEach(async function() {
      const expired = await calleth.methods.hasExpired().call();
      expired.should.be.false;
    });

    describe("can mint options by locking strike tokens (integer values)", function() {
      it("should mint if allowed to spend underlying tokens", async function() {
        await mintOptions();
      });

      it("should be some locked strike asset after exchange", async function() {
        await mintOptions();

        // Check locked balances
        const underlyingBalance = await calleth.methods
          .underlyingBalance()
          .call();
        underlyingBalance.should.be.equal((1e18).toString());
      });
    });

    describe("can mint options by locking strike tokens (decimal values)", function() {
      it("should mint if allowed to spend underlying tokens", async function() {
        await mintOptionsDecimals();
      });

      it("should be some locked strike asset after exchange", async function() {
        await mintOptionsDecimals();

        // Check locked balances
        const underlyingBalance = await calleth.methods
          .underlyingBalance()
          .call();
        underlyingBalance.should.be.equal((1e17).toString());
      });
    });

    describe("can burn options to get back my assets", function() {
      it("should be able to burn all my options for all my locked assets", async function() {
        await mintOptions();

        const initialEthAmount = await ZWeb3.getBalance(sellerAddress).then(
          balance => new BN(balance)
        );

        await checkBalances(
          sellerAddress,
          (1e18).toString(),
          (270e18).toString(),
          initialEthAmount.toString()
        );

        const burnTx = await calleth.methods
          .burn((1e18).toString())
          .send({ from: sellerAddress });

        const burnTxCost = await txCost(burnTx);

        const finalEthAmount = initialEthAmount
          .sub(burnTxCost)
          .add(new BN((1e18).toString()));

        await checkBalances(
          sellerAddress,
          "0",
          (270e18).toString(),
          finalEthAmount.toString()
        );
      });

        /**
         * - USDC holder has 100 USDC
         * - USDC holder mints 1 DAI:USDC for 1.000001 USDC: 1 DAI:USDC/98.999999 USDC
         * - USDC holder gives 1.000001 USDC to another holder: 1 DAI:USDC/97.999998 USDC
         * - Another holder mints 1 DAI:USDC and send back to USDC holder: 2 DAI:USDC/97.999998 USDC
         * - USDC holder tries to burn 2 DAI:USDC and fails because he has only 1.000001 USDC locked inside the contract
         */
        it("should not be able to burn more options than the amount of my locked tokens", async function() {
          await mintOptions();

          // Give 0.5 unit of OPT to another holder
          await calleth.methods
            .transfer(anotherRandomAddress, (5e17).toString())
            .send({ from: sellerAddress });

          await checkBalances(sellerAddress, (5e17).toString(), (270e18).toString(), null);

          let failed = false;
          try {
            await calleth.methods.burn((1e18).toString()).send({ from: sellerAddress });
          } catch (err) {
            failed = true;
          }
          failed.should.be.true;

          //now burn the correct amount
          const initialEthAmount = await ZWeb3.getBalance(sellerAddress).then(
            balance => new BN(balance)
          );
  
          await checkBalances(
            sellerAddress,
            (5e17).toString(),
            (270e18).toString(),
            initialEthAmount.toString()
          );
  
          const burnTx = await calleth.methods
            .burn((5e17).toString())
            .send({ from: sellerAddress });
  
          const burnTxCost = await txCost(burnTx);
  
          const finalEthAmount = initialEthAmount
            .sub(burnTxCost)
            .add(new BN((5e17).toString()));
  
          await checkBalances(
            sellerAddress,
            "0",
            (270e18).toString(),
            finalEthAmount.toString()
          );

        });
    });

    describe("can sell my underlying tokens for the strike tokens at the strike price", function() {
      async function exchangeOptions(amount) {
        await mintOptions();

        //approve strikeAsset before exchanging
        await mockStrikeAsset.methods
          .approve(calleth.address, (270e18).toString())
          .send({ from: sellerAddress });

        await checkBalances(
          sellerAddress,
          (1e18).toString(),
          (270e18).toString(),
          null
        );
        await calleth.methods.exchange(amount).send({ from: sellerAddress });
        await checkBalances(sellerAddress, "0", "0", null);
        // await checkBalances(daiHolder, "0", "1000001", "99000000000000000000");
      }

      it("should be able to exchange my options", async function() {
        await exchangeOptions((1e18).toString());
      });

      // it("should be some locked underlying asset after exchange", async function() {
      //   await exchangeOptions(amount);

      //   const underlyingBalance = await calleth.methods.underlyingBalance().call();
      //   underlyingBalance.should.be.equal((1e18).toString());

      //   const strikeBalance = await calleth.methods.strikeBalance().call();
      //   strikeBalance.should.be.equal("0");

      // });
    });

    it("can't withdraw", async function() {
      let failed = false;
      try {
        await calleth.methods.withdraw().send({ from: sellerAddress });
      } catch (err) {
        failed = true;
      }
      failed.should.be.true;
    });
  });

  describe("after expiration", function() {
    /**
     * Utility function to force the series expiration for these tests
     */
    async function forceExpiration() {
      await calleth.methods.forceExpiration().send({ from: sellerAddress });
      const expired = await calleth.methods.hasExpired().call();
      expired.should.be.true;
    }

    describe("can't mint, burn or exchange options anymore", function() {
      it("should not allow mint()", async function() {
        await checkBalances(sellerAddress, "0", (270e18).toString(), null);

        await forceExpiration();
        let failed = false;
        try {
          await calleth.methods
            .mint((1e18).toString())
            .send({ from: sellerAddress });
        } catch (err) {
          failed = true;
        }
        failed.should.be.true;
      });
    });

    describe("must allow transfers because of how uniswap liquidity pools work", function() {
      it("should allow transfer()", async function() {
        await mintOptions();
        await forceExpiration();

        await calleth.methods
          .transfer(anotherRandomAddress, (1e18).toString())
          .send({ from: sellerAddress });
      });

      it("should allow transferFrom()", async function() {
        await mintOptions();
        await forceExpiration();

        await calleth.methods
          .approve(anotherRandomAddress, (270e18).toString())
          .send({ from: sellerAddress });

        // const amountAllowed = await calleth.methods
        //   .allowance(sellerAddress, anotherRandomAddress)
        //   .scall();

        // console.log("amountAllowed", amountAllowed);

        await calleth.methods
          .transferFrom(sellerAddress, anotherRandomAddress, (1e18).toString())
          .send({ from: anotherRandomAddress });
      });
    });

    describe("should allow withdraw", function() {
      it("should allow withdraw with no balance", async function() {
        await forceExpiration();
        await calleth.methods.withdraw().send({ from: sellerAddress });
        await checkBalances(sellerAddress, "0", (270e18).toString(), null);
      });

      it("should allow withdraw locked asset with no holding options", async function() {
        await mintOptions();
        await calleth.methods
          .transfer(anotherRandomAddress, (1e18).toString())
          .send({ from: sellerAddress });

        await forceExpiration();

        await checkBalances(
          anotherRandomAddress,
          (1e18).toString(),
          null,
          null
        );
        const initialEthAmount = await ZWeb3.getBalance(sellerAddress).then(
          balance => new BN(balance)
        );
        const withdrawTx = await calleth.methods
          .withdraw()
          .send({ from: sellerAddress });
        const withdrawTxCost = await txCost(withdrawTx);

        // const finalEthAmount = await ZWeb3.getBalance(sellerAddress);
        const finalEthAmount = initialEthAmount
          .sub(withdrawTxCost)
          .add(new BN((1e18).toString()));

        await checkBalances(
          sellerAddress,
          "0",
          (270e18).toString(),
          finalEthAmount.toString()
        );

        const comparison = finalEthAmount > initialEthAmount;
        comparison.should.be.true;
      });

      it("should allow withdraw locked asset with was exercised by another user", async function() {
        await mintOptions();

        // Transfer 1 option to anotherRandomAddress
        await calleth.methods
          .transfer(anotherRandomAddress, (1e18).toString())
          .send({ from: sellerAddress });

        await mockStrikeAsset.methods
          .transfer(anotherRandomAddress, (270e18).toString())
          .send({ from: sellerAddress });

        // Exercise the option
        // 1) Approve calleth.address to transfer funds for anotherRandomAddress
        await mockStrikeAsset.methods
          .approve(calleth.address, (300e18).toString())
          .send({ from: anotherRandomAddress });

        // 2) Exchange calling with the amount of options tokens to exchange
        await calleth.methods
          .exchange((1e18).toString())
          .send({ from: anotherRandomAddress });

        const strikeAssetHoldByCall = await mockStrikeAsset.methods
          .balanceOf(calleth.address)
          .call();
        strikeAssetHoldByCall.should.be.equal((270e18).toString());

        const callEthStrikeAssetBalance = await calleth.methods
          .strikeBalance()
          .call();
        callEthStrikeAssetBalance.should.be.equal(strikeAssetHoldByCall);

        await forceExpiration();

        await calleth.methods.withdraw().send({ from: sellerAddress });
        await checkBalances(sellerAddress, "0", (270e18).toString(), null);
      });

      it("should allow withdraw a mix of locked strike asset and asset with was exercised by another user", async function() {
        // 1) SellerAddress -> Mint 1 OPT locking 1 ETH
        // 2) SellerAddress -> Send 0.5 OPT to AnotherAddress
        // 3) AnotherAddress -> Exchange 0.5 OPT + 135 DAI with calleth and receives 0.5 ETH
        // 4) locked at callth: 0.5 ETH and 135 DAI
        // 5) System -> forceExpiration()
        // 6) SellerAddress -> Withdraw (his lockedBalance: 1 option)
        // 7) Contract -> Sends -> 0.5 ETH + 135 DAI

        // 1)
        await checkBalances(sellerAddress, "0", (270e18).toString(), null);

        const initialEthAmount = await ZWeb3.getBalance(sellerAddress).then(
          balance => new BN(balance)
        );
        const ethAmountToLock = (1e18).toString();
        const mintTx = await calleth.methods
          .mint()
          .send({ from: sellerAddress, value: ethAmountToLock });

        const mintTxCost = await txCost(mintTx);
        const finalEthAmount = initialEthAmount
          .sub(new BN(ethAmountToLock))
          .sub(mintTxCost);

        await checkBalances(
          sellerAddress,
          (1e18).toString(),
          (270e18).toString(),
          finalEthAmount.toString()
        );

        //2 Transfer  270 DAI strikeAsset to AnotherRandomAddress
        await mockStrikeAsset.methods
          .transfer(anotherRandomAddress, (270e18).toString())
          .send({ from: sellerAddress });
        //3 Transfer 1 OPT to AnotherRandomAddress
        await calleth.methods
          .transfer(anotherRandomAddress, (1e18).toString())
          .send({ from: sellerAddress });

        await checkBalances(
          anotherRandomAddress,
          (1e18).toString(),
          (270e18).toString(),
          null
        );

        // Exercise only 0.5 OPT
        //4 Approve calleth to transfer funds to anotherRandomAddress
        await mockStrikeAsset.methods
          .approve(calleth.address, (300e18).toString())
          .send({ from: anotherRandomAddress });

        const initialEthAmount2 = await ZWeb3.getBalance(
          anotherRandomAddress
        ).then(balance => new BN(balance));

        const exchangeTx = await calleth.methods
          .exchange((5e17).toString())
          .send({ from: anotherRandomAddress });

        const exchangeTxCost = await txCost(exchangeTx);

        const finalEthAmount2 = initialEthAmount2
          .add(new BN((5e17).toString()))
          .sub(exchangeTxCost);

        await checkBalances(
          anotherRandomAddress,
          (5e17).toString(),
          (135e18).toString(),
          finalEthAmount2.toString()
        );

        //5 Expiration
        await forceExpiration();

        const initialEthAmount3 = await ZWeb3.getBalance(sellerAddress).then(
          balance => new BN(balance)
        );
        const withdrawTx = await calleth.methods
          .withdraw()
          .send({ from: sellerAddress });
        const withdrawTxCost = await txCost(withdrawTx);
        const finalEthAmount3 = initialEthAmount3
          .sub(withdrawTxCost)
          .add(new BN((5e17).toString()));

        // await checkBalances(
        //   sellerAddress,
        //   (1e18).toString(),
        //   (135e18).toString(),
        //   finalEthAmount3.toString()
        // );
      });
    });
  });
});
