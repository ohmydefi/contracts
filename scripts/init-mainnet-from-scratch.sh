#!/bin/sh
set -e -o pipefail

OZ_FILE="./.openzeppelin/mainnet.json"
rm -f $OZ_FILE

npx oz session --network mainnet --no-interactive
npx oz push

# Token mainnet addresses
DAI_ADDRESS="0x6b175474e89094c44da98b954eedeac495271d0f"
STRIKE_ADDRESS="0x6b175474e89094c44da98b954eedeac495271d0f"
USDC_ADDRESS="0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
STRIKE_PRICE="230000000"
STRIKE_PRICE_DECIMALS="6"
# # Creates the option series

# Estimate block number for Dec 3, 2019 == Nov 19 + 80640 blocks
# 80640 == (14 days * 24 hours * 60 min * 4 blocks/min)
EXPIRATION_BLOCK="9698679"

# Creates the option series
npx oz create PutETH --init initialize --args "\"pohETH 230:1 DAI\",\"POHETH:DAI\",$STRIKE_ADDRESS,$STRIKE_PRICE,$STRIKE_PRICE_DECIMALS, $EXPIRATION_BLOCK"
OPTION_ADDRESS=`cat $OZ_FILE | jq '.proxies["contracts/PutETH"][0].address' -r`

echo "\n\nSummary:\n"
echo "My address: $MY_ADDRESS"
echo "DAI address: $DAI_ADDRESS"
echo "USDC address: $USDC_ADDRESS"
echo "Option address: $OPTION_ADDRESS"
