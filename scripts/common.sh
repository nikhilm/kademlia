#!/bin/bash

ip='10.100.98.71'

function xt() {
    echo xterm -geometry 100x32 -T "$1" -e node run.js $2:$3 $4:$5 &
    xterm -geometry 100x32 -hold -T "$1" -e node run.js $2:$3 $4:$5 &
}
