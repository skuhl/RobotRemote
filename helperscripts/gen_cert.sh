mkdir cert
openssl req -config openssl-server.cnf -newkey rsa:2048 -sha256 -nodes -keyout cert/key.pem -out cert/cert.csr -outform PEM
openssl ca -config openssl-ca.cnf -policy signing_policy -extensions signing_req -out cert/cert.pem -infiles cert/cert.csr