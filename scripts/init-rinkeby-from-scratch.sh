#!/bin/sh
set -e -o pipefail

# Token mainnet addresses
DAI_ADDRESS="0x8Aad492fEDBbf7f00Fa7fCD6A371CF6eeb21fc72"

# Estimate block number for Dec 3, 2019 == Nov 19 + 80640 blocks
# 80640 == (14 days * 24 hours * 60 min * 4 blocks/min)
EXPIRATION_BLOCK="9530962"
STRIKE_PRICE="270"
# Creates the option series
npx oz create PutETH --init initialize --args "\"cohETH 270:1 DAI\",\"COHETH:DAI\",$DAI_ADDRESS,$STRIKE_PRICE,$EXPIRATION_BLOCK"
PUT_ADDRESS=`cat $OZ_FILE | jq '.proxies["contracts/PutETH"][0].address' -r`

npx oz create CallETH --init initialize --args "\"cohETH 270:1 DAI\",\"COHETH:DAI\",$DAI_ADDRESS,$STRIKE_PRICE,$EXPIRATION_BLOCK"
CALL_ADDRESS=`cat $OZ_FILE | jq '.proxies["contracts/CallETH"][0].address' -r`

echo "\n\nSummary:\n"
echo "My address: $MY_ADDRESS"
echo "DAI address: $DAI_ADDRESS"
echo "Put address: $PUT_ADDRESS"

