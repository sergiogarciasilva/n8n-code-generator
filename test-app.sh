#!/bin/bash

# n8n Code Generator - Test Compiled Application
# Simple test script to verify the compiled system works

echo "🤖 Testing n8n Agent Platform Compiled System"
echo "=============================================="

cd /home/sergio/n8n_code_generator_github/n8n-agent-platform/core

echo ""
echo "📦 Checking compiled code..."
if [ -f "dist/index.js" ]; then
    echo "✅ Compiled JavaScript found"
    ls -la dist/index.js
else
    echo "❌ Compiled code not found"
    exit 1
fi

echo ""
echo "🔍 Testing basic Node.js execution..."
if node -e "console.log('Node.js is working')"; then
    echo "✅ Node.js runtime is ready"
else
    echo "❌ Node.js issue detected"
    exit 1
fi

echo ""
echo "📋 Checking dependencies..."
if npm list --depth=0 > /dev/null 2>&1; then
    echo "✅ Dependencies are installed"
else
    echo "⚠️ Some dependencies may be missing"
fi

echo ""
echo "🚀 Starting quick test of compiled system..."
echo "   (Will run for 10 seconds then exit)"

# Test with timeout
timeout 10s node dist/index.js &
PID=$!

sleep 5

# Check if process is running
if kill -0 $PID 2>/dev/null; then
    echo "✅ Compiled system started successfully!"
    echo "🔗 Platform should be available at: http://localhost:3456"
else
    echo "❌ System failed to start"
fi

# Clean up
kill $PID 2>/dev/null || true

echo ""
echo "🎯 Test completed! To start the full system:"
echo "   ./start-all.sh"
echo ""
echo "📱 Or use the desktop application: n8n Code Generator"