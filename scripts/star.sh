#!/bin/bash

. scripts/common.sh

port=10000
n=$1

id=`node -e "console.log(require('./lib/util').nodeID('$KADEMLIA_BIND_ADDRESS', $port))"`
xt "$id $KADEMLIA_BIND_ADDRESS:$port" $KADEMLIA_BIND_ADDRESS $port

orig=$port
for ((i=1; i<n;i++))
do
    port=$((prev + RANDOM))
    if [ $port -gt 65535 ]
    then
        port=$((10001 + port%65535))
    fi
    id=`node -e "console.log(require('./lib/util').nodeID('$KADEMLIA_BIND_ADDRESS', $port))"`
    xt "$id $KADEMLIA_BIND_ADDRESS:$port" $KADEMLIA_BIND_ADDRESS $port $KADEMLIA_BIND_ADDRESS $orig
    if [ $(( i % 10 )) -eq 0 ]
    then
        sleep 1
    fi
done
