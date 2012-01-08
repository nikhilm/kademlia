#!/bin/bash

. scripts/common.sh

port=10000
n=$1

id=`node -e "console.log(require('./lib/util').nodeID('$ip', $port))"`
xt "$id $ip:$port" $ip $port

prev=$port
for ((i=1; i<n;i++))
do
    port=$((prev + RANDOM))
    if [ $port -gt 65535 ]
    then
        port=$((10001 + port%65535))
    fi
    id=`node -e "console.log(require('./lib/util').nodeID('$ip', $port))"`
    xt "$id $ip:$port" $ip $port $ip $prev
    prev=$port
    if [ $(( i % 10 )) -eq 0 ]
    then
        sleep 1
    fi
done
