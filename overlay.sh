#!/bin/bash

function xt() {
    echo xterm -geometry 100x32 -T "$1" -e node run.js $2:$3 $4:$5 &
    xterm -geometry 100x32 -T "$1" -e node run.js $2:$3 $4:$5 &
}

ip='10.100.98.60'
port=10000
n=$1

id=`node -e "console.log(require('./lib/util').nodeID('$ip', $port))"`
xt "$id $ip:$port" $ip $port

prev=$port
for ((i=1; i<n;i++))
do
    port=$((prev + RANDOM))
    id=`node -e "console.log(require('./lib/util').nodeID('$ip', $port))"`
    xt "$id $ip:$port" $ip $port $ip $prev
    prev=$port
done
