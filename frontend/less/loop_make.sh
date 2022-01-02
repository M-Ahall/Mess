#!/bin/bash

while true
do
	# inotifywait -q -e MOVE_SELF *less
	inotifywait -q -e MODIFY *less
	sleep 0.5
	clear
	if make -j2; then
		echo -e "\n\e[32;1mOK!\e[0m"
		sleep 2
		clear
	fi
done
