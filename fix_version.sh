#!/bin/bash

version=$(cat frontend/version)
error=0

sed -i -E -e "s#\"(css|js)/v[0-9]+\.[0-9]+\.[0-9]+/#\"\1/$version/#" frontend/*.html
