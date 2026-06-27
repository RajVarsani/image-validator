#!/bin/bash
# Runs once LocalStack is ready. Creates the images bucket (private by default).
awslocal s3 mb s3://images || true
echo "bucket 'images' ready"
