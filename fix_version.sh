#!/bin/bash

version=$(cat frontend/version)
error=0

sed -i -E \
	-e "s#\"(css|js)/v[0-9]+\.[0-9]+\.[0-9]+/#\"\1/$version/#" \
	frontend/*.html

sed -i -E \
	-e "s/^([\t ]+version *= *)[\"']v[0-9]+\.[0-9]+\.[0-9]+[\"'](.*)$/\1'$version'\2/" \
	frontend/js/src/socket.js
