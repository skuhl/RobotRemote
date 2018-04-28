# RobotRemote
Project to remotely control a robotic arm.

## Mechanism
Currently, the node portion runs the webserver, which the client connects to.

This webpage uses WebSockets to send data back to the node server, which then sends relays this data to the python server.

The python server listens on a socket for a connection, which contains data about what solenoids to actuate. This data is send to a thread, which is constantly communicating with a PLC. This is necessary, because if there is a disconnection between the PLC and the server actuating the solenoids, we want to stop actuating said solenoids, as a sort of safety feature.

## Setup
This setup is meant for linux. If you would like to run on Windows 10, these instructions are compatable with [Ubuntu for Windows](https://www.microsoft.com/en-us/store/p/ubuntu/9nblggh4msv6).

1. Pull this repository into a directory (`git clone https://github.com/skuhl/RobotRemote`).
2. Install npm and node. On Debian based distibutions (including ubuntu and derivatives), this would be `sudo apt-get update && sudo apt-get install nodejs`
3. Install pip. Python is usually already installed on most distributions. Pip can be installed as explained [here](https://pip.pypa.io/en/stable/installing/).
4. Install necessary modules for Node. This can be done through npm. CD to the node folder, then execute `npm install`.
5. Run the node portion of the stack. This can be done by running `npm start`.
6. Install the python dependencies. This can be done by first entering the virtual environment for python. CD into the pyhton folder, then execute `source bin/activate`. Always do this before running the server. Then, execute `pip install -r requirements.txt` 
7. Run the python version of the server. You can do this by executing `python server.py`
8. Connect to `localhost:3000` in your web browser. You should now be connected to the node server. Pressing the buttons on this page should send information to the python server.
