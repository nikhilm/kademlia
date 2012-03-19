#!/bin/bash

# expects port as first argument
function kad_node_id() {
    id=$(node -e "console.log(require('./lib/util').nodeID('$KADEMLIA_BIND_ADDRESS', $1))")
    echo $id
}

# params: nodeId, address, port
function kad_title() {
    echo ${1:0:6}::$3
}

function xt() {
    echo xterm -geometry 70x10 -T "$1" -e node run.js $2:$3 $4:$5 &
    xterm -geometry 70x10 -hold -T "$1" -e node run.js $2:$3 $4:$5 &
}
