#!/bin/bash

# Define the packages directory
PACKAGES_DIR="./packages"  # Adjust the path if necessary

# Check if the packages directory exists
if [ -d "$PACKAGES_DIR" ]; then
    # Find all .git directories within packages and remove them
    find "$PACKAGES_DIR" -type d -name ".git" -print -exec rm -rf {} \; 2>/dev/null
    
    echo "Removed all .git folders in $PACKAGES_DIR and its subdirectories."
else
    echo "Directory $PACKAGES_DIR does not exist."
fi