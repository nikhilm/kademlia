#!/bin/bash

ip='10.100.98.39'
startPort=10000
n=$1

title="$ip:$startPort"
xterm -T $title -e node run.js $ip:$startPort &

prev=$startPort
for ((i=1; i<n;i++))
do
	port=$((startPort + RANDOM))
	title="$ip:$port"
    xterm -T $title -e node run.js $ip:$port $ip:$prev &
    prev=$port
done
