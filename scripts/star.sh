#!/bin/bash

. scripts/common.sh

ip='10.100.98.60'
port=10000
n=$1

id=`node -e "console.log(require('./lib/util').nodeID('$ip', $port))"`
xt "$id $ip:$port" $ip $port

orig=$port
for ((i=1; i<n;i++))
do
    port=$((prev + RANDOM))
    id=`node -e "console.log(require('./lib/util').nodeID('$ip', $port))"`
    xt "$id $ip:$port" $ip $port $ip $orig
done
