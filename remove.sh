#!/bin/bash

# Change to the packages directory
cd packages

# Find all directories that don't contain package.json
for dir in */; do
    if [ ! -f "${dir}package.json" ]; then
        echo "Directory without package.json found: $dir"
        rm -rf "$dir"
    fi
done

echo "Cleanup in packages directory complete!"