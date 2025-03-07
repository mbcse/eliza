#!/bin/bash

# Ensure the script is executed from the workspace root
if [ ! -f "pnpm-workspace.yaml" ]; then
  echo "Error: Please run this script from the root of your pnpm workspace."
  exit 1
fi

# Initialize an array to hold package names
packages=()

# Iterate over each subdirectory in the packages directory
for dir in packages/*/; do
  # Check if package.json exists in the directory
  if [ -f "$dir/package.json" ]; then
    # Extract the package name using jq
    package_name=$(jq -r '.name' "$dir/package.json")
    # Create a temporary package.json file for installation
    echo "{\"dependencies\": {\"$package_name\": \"workspace:*\"}}" > temp-package.json
    # Use this temporary file to add the dependency
    pnpm add --filter=agent "$package_name@workspace:*" --save-exact
    rm temp-package.json
  else
    echo "Skipping $dir: package.json not found."
  fi
done

# Update all workspace:* dependencies to use exact workspace:* notation
jq '.dependencies |= with_entries(if .value | startswith("workspace:") then .value = "workspace:*" else . end)' agent/package.json > agent/package.json.tmp
mv agent/package.json.tmp agent/package.json