#!/bin/bash
mkdir keys
openssl genrsa -out keys/secret_key.pem 2048
openssl rsa -in keys/secret_key.pem -outform PEM -pubout -out keys/pub_key.pem