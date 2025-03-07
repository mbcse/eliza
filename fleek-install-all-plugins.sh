#!/bin/bash

# Script to install all available elizaOS plugins

echo "Fetching list of available plugins..."
# Run the list command and capture the output
PLUGIN_LIST=$(npx elizaos plugins list)

# Extract plugin names from the output
# The format is expected to be lines like "    @elizaos-plugins/plugin-name"
# or "✅  @elizaos-plugins/plugin-name" for already installed plugins
PLUGINS=$(echo "$PLUGIN_LIST" | grep "@elizaos-plugins/" | sed 's/^[ ✅]*//g' | tr -d ' ')

# Count total plugins
TOTAL=$(echo "$PLUGINS" | wc -l)
echo "Found $TOTAL plugins to install"

# Directory and file to log installed plugins
FLEEK_DIR="fleek"
INSTALLED_PLUGINS_FILE="$FLEEK_DIR/installed_plugins.txt"
mkdir -p "$FLEEK_DIR"
touch "$INSTALLED_PLUGINS_FILE"

# Counter for progress
COUNT=0

# Install each plugin
echo "$PLUGINS" | while read -r PLUGIN; do
  if [ -n "$PLUGIN" ]; then
    # Check if the plugin is already installed
    if grep -q "$PLUGIN" "$INSTALLED_PLUGINS_FILE"; then
      echo "[$COUNT/$TOTAL] Skipping $PLUGIN (already installed)"
      continue
    fi

    COUNT=$((COUNT + 1))
    echo "[$COUNT/$TOTAL] Installing $PLUGIN..."
    npx elizaos plugins add "$PLUGIN"
    echo "$PLUGIN" >> "$INSTALLED_PLUGINS_FILE"
    echo "----------------------------------------"
  fi
done

echo "All plugins installation attempted!"
echo "Note: Some plugins might have failed to install due to dependencies or other issues."
echo "Check the output above for any errors." 