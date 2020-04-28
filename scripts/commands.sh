# SELLER=0xA4Dab070c69bD3985C11630004240891881f2AEd

OZ_FILE_NAME=`ls .openzeppelin/dev*`

# OZ_FILE="../.openzeppelin/$TESTNET_NAME.json"
STRIKE_ADDRESS=`cat $OZ_FILE_NAME | jq '.proxies["@openzeppelin/contracts-ethereum-package/StandaloneERC20"][0].address' -r`

PUT_ADDRESS=`cat $OZ_FILE_NAME | jq '.proxies["ro/PutETH"][0].address' -r`

echo "SELLER: $SELLER"
echo "PUT_ADDRESS address: $PUT_ADDRESS"

# npx oz send-tx -n development --from $SELLER --to $STRIKE_ADDRESS --method approve --args "$PUT_ADDRESS, 2000000000000000000"

npx oz send-tx -n development --from $SELLER --to $PUT_ADDRESS --method mint --args "1000000000000000000"

# npx oz send-tx -n development --from $SELLER --to $OPTION_ADDRESS --value 1000000000000000000 --method exchange