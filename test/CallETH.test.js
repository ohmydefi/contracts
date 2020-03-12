const { TestHelper } = require("@openzeppelin/cli");
const { Contracts, ZWeb3 } = require("@openzeppelin/upgrades");

ZWeb3.initialize(web3.currentProvider);

const CallETH = Contracts.getFromLocal("CallETH");
const StandaloneERC20 = Contracts.getFromNodeModules(
  "@openzeppelin/contracts-ethereum-package",
  "StandaloneERC20"
);

require("chai").should();

contract("CallETH", function(accounts) {
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
        "coH:ETH:STRIKE",
        mockStrikeAsset.address,
        270000000,
        6,
        "1000001"
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
      console.log("underlyingBalance", underlyingBalance);
      underlyingBalance.should.be.equal(underlyingAsset);
    }

    // if (underlyingAsset !== null) {
    //   const daiBalance = await mockUnderlyingAsset.methods.balanceOf(account).call();
    //   daiBalance.should.be.equal(underlyingAsset);
    // }
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

    // describe("can burn options to get back my assets", function() {
    //   /**
    //    * - USDC holder has 100 USDC
    //    * - USDC holder mints 1 DAI:USDC for 1.000001 USDC: 1 DAI:USDC/98.999999 USDC
    //    * - USDC holder burns 1 DAI_USDC for 1.000001 USDC back: 0 DAI:USDC/100 USDC
    //    */
    //   it("should be able to burn all my options for all my locked assets", async function() {
    //     await mintOptions();

    //     await option.methods.burn("1").send({ from: usdcHolder });

    //     await checkBalances(usdcHolder, "0", "100000000", "0");
    //     await checkBalances(daiHolder, "0", "0", "100000000000000000000");
    //   });

    //   /**
    //    * - USDC holder has 100 USDC
    //    * - USDC holder mints 1 DAI:USDC for 1.000001 USDC: 1 DAI:USDC/98.999999 USDC
    //    * - USDC holder gives 1.000001 USDC to another holder: 1 DAI:USDC/97.999998 USDC
    //    * - Another holder mints 1 DAI:USDC and send back to USDC holder: 2 DAI:USDC/97.999998 USDC
    //    * - USDC holder tries to burn 2 DAI:USDC and fails because he has only 1.000001 USDC locked inside the contract
    //    */
    //   it("should not be able to burn more options than the amount of my locked tokens", async function() {
    //     await mintOptions();

    //     // Give 1 unit of USDC to another holder and mint 1 option from there
    //     await mockUSDC.methods
    //       .transfer(anotherUsdcHolder, "1000001")
    //       .send({ from: usdcHolder });
    //     await mintOptionsAndCheck(
    //       anotherUsdcHolder,
    //       "1",
    //       "1000001",
    //       ["0", "1000000000000000000"],
    //       ["1000001", "0"]
    //     );

    //     // Send 1 option back to USDC holder and try to burn everything
    //     await option.methods
    //       .transfer(usdcHolder, "1000000000000000000")
    //       .send({ from: anotherUsdcHolder });
    //     await checkBalances(usdcHolder, "2000000000000000000", "97999998", "0");

    //     let failed = false;
    //     try {
    //       await option.methods.burn("2").send({ from: usdcHolder });
    //     } catch (err) {
    //       failed = true;
    //     }
    //     failed.should.be.true;
    //   });
    // });

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
        //   .call();

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
        const initialEthAmount = await ZWeb3.getBalance(sellerAddress);
        await calleth.methods.withdraw().send({ from: sellerAddress });
        const finalEthAmount = await ZWeb3.getBalance(sellerAddress);
        const comparison = finalEthAmount > initialEthAmount;
        comparison.should.be.true;
      });

      it("should allow withdraw locked asset with was exercised by another user", async function() {
        await mintOptions();

        // Transfer 1 option to DAI holder
        await calleth.methods
          .transfer(anotherRandomAddress, (1e18).toString())
          .send({ from: sellerAddress });

        await mockStrikeAsset.methods
          .transfer(anotherRandomAddress, (270e18).toString())
          .send({ from: sellerAddress });

        // Exercise the option
        await mockStrikeAsset.methods
          .approve(calleth.address, (300e18).toString())
          .send({ from: anotherRandomAddress });

        await calleth.methods.exchange((1e18).toString()).send({ from: anotherRandomAddress });

        const strikeAssetHoldByCall = await mockStrikeAsset.methods.balanceOf(calleth.address).call()
        strikeAssetHoldByCall.should.be.equal((270e18).toString())

        const callEthStrikeAssetBalance = await calleth.methods.strikeBalance().call()
        callEthStrikeAssetBalance.should.be.equal(strikeAssetHoldByCall)

        await forceExpiration();

        await calleth.methods.withdraw().send({ from: sellerAddress });
        await checkBalances(sellerAddress, "0", (270e18).toString(), null);
      });
    });

    //   // it("should allow withdraw a mix of locked strike asset and asset with was exercised by another user", async function() {
    //   //   // Mint 3 options
    //   //   await mockUSDC.methods
    //   //     .approve(option.address, "3000003")
    //   //     .send({ from: usdcHolder });

    //   //   await checkBalances(usdcHolder, "0", "100000000", "0");
    //   //   await checkBalances(daiHolder, "0", "0", "100000000000000000000");

    //   //   await option.methods.mint("3").send({ from: usdcHolder });

    //   //   await checkBalances(usdcHolder, "3000000000000000000", "96999997", "0");
    //   //   await checkBalances(daiHolder, "0", "0", "100000000000000000000");

    //   //   // Transfer 1 option to DAI holder
    //   //   await option.methods
    //   //     .transfer(daiHolder, "1000000000000000000")
    //   //     .send({ from: usdcHolder });
    //   //   await checkBalances(usdcHolder, "2000000000000000000", "96999997", "0");
    //   //   await checkBalances(
    //   //     daiHolder,
    //   //     "1000000000000000000",
    //   //     "0",
    //   //     "100000000000000000000"
    //   //   );

    //   //   // Exercise the option
    //   //   await mockDAI.methods
    //   //     .approve(option.address, "1000000000000000000")
    //   //     .send({ from: daiHolder });
    //   //   await option.methods.exchange("1").send({ from: daiHolder });
    //   //   await checkBalances(usdcHolder, "2000000000000000000", "96999997", "0");
    //   //   await checkBalances(daiHolder, "0", "1000001", "99000000000000000000");

    //   //   await forceExpiration();

    //   //   await option.methods.withdraw().send({ from: usdcHolder });
    //   //   await checkBalances(
    //   //     usdcHolder,
    //   //     "2000000000000000000",
    //   //     "98999999",
    //   //     "1000000000000000000"
    //   //   );
    //   // });
  });
});
