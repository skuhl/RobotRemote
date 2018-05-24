# RobotRemote
Project to remotely control a robotic arm.

## Mechanism
Currently, the node portion runs the webserver, which the client connects to.

This webpage uses WebSockets to send data back to the node server, which then sends relays this data to the python server.

The python server listens on a socket for a connection, which contains data about what solenoids to actuate. This data is send to a thread, which is constantly communicating with a PLC. This is necessary, because if there is a disconnection between the PLC and the server actuating the solenoids, we want to stop actuating said solenoids, as a sort of safety feature.

## Setup
This setup is meant for Linux. If you would like to run on Windows 10, these instructions are compatable with [Ubuntu for Windows](https://www.microsoft.com/en-us/store/p/ubuntu/9nblggh4msv6).

1. Pull this repository into a directory (`git clone https://github.com/skuhl/RobotRemote`).
2. Install npm and node. On Debian based distributions (including ubuntu and derivatives), this would be `sudo apt-get update && sudo apt-get install nodejs`
3. Install necessary modules for Node. This can be done through npm. CD to the node folder, then execute `npm install`.
4. Run the node portion of the stack. This can be done by running `npm start`.
5. Install python 3.5 or above. On Debian based distrubutions, this would be installed using `sudo apt-get install python3`. This may already be installed on your system.
6. Install pip. Pip can typically be installed through your package manager (`sudo apt-get install pip3`), but make sure you're getting the python3 compatable version (this is the 3 at the end of pip3). Pip can also be installed as explained [here](https://pip.pypa.io/en/stable/installing/).
7. Create a virtual environment. This can be done by first installing virtualenv (`sudo apt-get install virtualenv`). Then, navigate to the root folder of the git repository, and run `virtualenv -p python3 python`. To check to make sure that your virtual environment worked, CD into the python directory, and execute `source bin/activate`. This enters the virtual environment. Now, execute `python --version`, and verify that your python version is 3.5.x or higher.
8. Install the python dependencies. This can be done by first entering the virtual environment for python. CD into the pyhton folder, then execute `source bin/activate`. Always do this before running the server. Then, execute `pip install -r requirements.txt` 
9. Run the python version of the server. You can do this by executing `python server.py`
10. Connect to `localhost:3000` in your web browser. You should now be connected to the node server. Pressing the buttons on this page should send information to the python server.

## Options
### Node webserver (node/settings.json)
| Option     | Purpose | Possible Values |
| ---------- | ------- | --------------- |
|`mysql_host`|Specify the location of the mysql server|Host name or IP address.|
|`mysql_user`|Specify the username for the database server|A valid mysql username.|
|`mysql_pass`|specify the password for the database server|The password for the username given in `mysql_user`|
|`mysql_db`|Specify the name of the database being used|Database set up with the schema provided in `db_setup.sql` |
| `actuators`| Specify information about actuator servers that this webserver can connect clients to. | `actuators` is an array containing actuator objects. Each of these objects contain the `ip` and `port` that the actuator socket listens on.|
|`cert_file` | Specify a certificate for this webserver, so that HTTPS may be used | This is a string, giving the path to the file containing the certificate. If this is an empty string, then no certificate will be used, and the server will run in insecure HTTP. It is recommended that you use a certificate. (TODO CERTBOT)|
|`key_file`  | Specify the key file used with your certificate. | This is a string, giving the path to the file containing the private key for your certificate. If the `cert_file` is specified, then this option must be specified, otherwise the server will not run properly.|
|`ca_file`   | Specify an optional file to use for certificate authorities | This option may be a file containing a list of certificate authorities, or it may be an empty string, in which case the system default certificate authorities are used.|
|`debug`     | Enables various behaviors related to debugging. This option is insecure, as it uses SSL without verifying certificates. | For production, always use `false`. For testing, you may consider setting this to `true`, which may allow testing SSL based work without a proper certificate.|
|`smtp_username`|Specify  what email to send verification emails from|A valid Gmail account that has "Allow less secure apps" turned OFF|
|`smtp_password`|Allows app access to send emails from specified account |Password for the email used in `smtp_username`|
|`domain_name`|Specify the domain of the site|Any valid domain that you are hosting|

### Python actuator server (python/settings.json)
| Option         | Purpose | Possible Values |
| -------------- | ------- | --------------- |
|`verbose`| Allows you to control the amount of output from this server | `true` will print more information, while `false` will print only the essentials (server errors)
|`socket_port`| Specify which port this actuator server will take commands from | This is a small integer. Try to keep this above 1024, as ports below that are reserved for other well-known services. This value must match what you have for this actuator in the webserver configuration.  Any integer between 1024 and 65535 is acceptable. |
|`websocket_port`|Specify the socket for the python actuator server to communicate with the client.|Any integer between 1024 and 65535 is acceptable. |
|`websocket_accepted_origins`|A list of sites that the websocket can accept connections from.|Domain names or IP addresses.|
|`disable_modbus`| Disables modbus communications. This is useful for testing when a PLC is not available. | Should be `false` in production, or `true` for testing if no PLC is connected. The following modbus options are ignored if this is set to `true`|
|`modbus_host`| IP address of the modbus host. | A valid IP address.|
|`modbus_port`| Port that your modbus server is running on | An integer between 0 and 65535|
|`modbus_slave_num`|Slave number of the PLC you want to control.|A small integer, typically 0. This depends on your setup.|
|`modbus_timeout`|The amount of seconds to wait before giving up on connecting to the PLC| A positive float value, denoting the number of seconds to wait.|
|`modbus_sleep_inteval`| The amount of time to wait in between sending messages to the PLC. This is done so that if a disconnection does occur, the PLC may shut itself off in emergency.| A positive float value, denoting the number of seconds to wait.|
|`cert_file` | Specify a certificate for this actuator server, so that secure sockets/websockets may be used | This is a string, giving the path to the file containing the certificate. If this is an empty string, then no certificate will be used, and the server will run in insecure mode. It is recommended that you use a certificate. (TODO CERTBOT)|
|`key_file`| Specify the key file used with your certificate. | This is a string, giving the path to the file containing the private key for your certificate. If the `cert_file` is specified, then this option must be specified, otherwise the server will not run properly.|
|`ca_file`| Specify an optional file to use for certificate authorities | This option may be a file containing a list of certificate authorities, or it may be an empty string, in which case the system default certificate authorities are used.|
|`debug`| Enables various behaviors related to debugging. This option is insecure, as it uses SSL without verifying certificates. | For production, always use `false`. For testing, you may consider setting this to `true`, which may allow testing SSL based work without a proper certificate.|
|`pin_assignments`| A mapping of symbolic button names to modbus addresses. These are actually the modbus addresses + 1, since this is how CLICK decided to show the addresses in their software.| A positive integer corresponding to the modbus address of the coil to activate when the mesage is received. If an address maps to 0, the message will be ignored, and no coils will be activated for that message.|
