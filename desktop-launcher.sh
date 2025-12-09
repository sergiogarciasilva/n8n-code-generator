#!/bin/bash

# Desktop launcher wrapper script with better error handling

# Log file for debugging
LOG_FILE="/tmp/n8n-code-generator-launcher.log"

echo "=== n8n Code Generator Desktop Launcher ===" > "$LOG_FILE"
echo "Started at: $(date)" >> "$LOG_FILE"
echo "User: $USER" >> "$LOG_FILE"
echo "HOME: $HOME" >> "$LOG_FILE"
echo "PATH: $PATH" >> "$LOG_FILE"
echo "PWD: $PWD" >> "$LOG_FILE"

# Change to the script directory
cd /home/sergio/n8n_code_generator_github

# Execute the start script and log output
echo "Executing start-all.sh..." >> "$LOG_FILE"
bash /home/sergio/n8n_code_generator_github/start-all.sh >> "$LOG_FILE" 2>&1

# Check exit status
EXIT_CODE=$?
echo "Exit code: $EXIT_CODE" >> "$LOG_FILE"

if [ $EXIT_CODE -ne 0 ]; then
    echo "Script failed with exit code $EXIT_CODE" >> "$LOG_FILE"
    # Show error dialog
    zenity --error --text="n8n Code Generator failed to start. Check /tmp/n8n-code-generator-launcher.log for details." 2>/dev/null || true
fi

echo "Finished at: $(date)" >> "$LOG_FILE"