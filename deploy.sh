#!/usr/bin/env bash
set -e

echo "🚀 Building ChatWave production bundle..."
bun run build

echo "⚡ Deploying to Cloudflare Workers via bunx wrangler..."
bunx wrangler deploy

echo "✅ Successfully deployed to Cloudflare!"
echo "🌐 Live URL: https://chatwave.whosh289.workers.dev"
