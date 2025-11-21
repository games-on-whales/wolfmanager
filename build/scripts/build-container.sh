#!/bin/bash
set -e

echo "Building wolfmanager:test container..."
# Ensure we are at the project root
cd "$(dirname "$0")/../.."

docker build -f build/Dockerfile -t wolfmanager:test .