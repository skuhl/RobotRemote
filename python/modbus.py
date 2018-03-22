from threading import Thread
import modbus_tk.defines as cst
import time
from modbus_tk import modbus_tcp, hooks

class ModbusThread(Thread):
    def __init__(self, server_options, pressed_data, pressed_data_lock):
        Thread.__init__(self)
        self.opts = server_options
        #Pressed data is a list of strings, and is modified by both threads. Thus, a lock is needed.
        self.pressed_data = pressed_data
        self.pressed_data_lock = pressed_data_lock
        self.should_die = False
        #Setup modbus master
        def on_after_recv(data):
            master, bytes_data = data
            #print(bytes_data)

        hooks.install_hook('modbus.Master.after_recv', on_after_recv)

        try:

            def on_before_connect(args):
                master = args[0]
                print("Connecting to PLC")

            hooks.install_hook("modbus_tcp.TcpMaster.before_connect", on_before_connect)

            def on_after_recv2(args):
                response = args[1]
                #print("on_after_recv2", len(response), "bytes received")

            hooks.install_hook("modbus_tcp.TcpMaster.after_recv", on_after_recv2)

            # Connect to the slave
            self.master = modbus_tcp.TcpMaster(host = server_options['modbus_host'], port = server_options['modbus_port'])
            self.master.set_timeout(server_options['modbus_timeout'])
        except modbus_tk.modbus.ModbusError as exc:
            print(str(exc) + "- Code=" + str(exc.get_exception_code()))

    def run(self):
        #Computes runs of coils, so we can write multiple coils at once
        coil_runs = []
        coil_pins = []
        for key in self.opts['pin_assignments']:
            coil_pins.append(self.opts['pin_assignments'][key])
        
        #Sort in ascending order
        coil_pins.sort()

        for (i, val) in enumerate(coil_pins):
            if i == 0:
                coil_runs.append(CoilRun(val))
            else:
                #Add the coil to the last run if it continues.
                if coil_runs[-1].max_coil + 1 == val:
                    coil_runs[-1].add_coil(val)
                #Create a new run if the current pin isn't in the run.
                elif not coil_runs[-1].contains_coil(val):
                    coil_runs.append(CoilRun(val))
        
        while not self.should_die:
            #Run the server
            #Reset coil_data to 0.
            for run in coil_runs:
                run.reset_coil_data()
            
            self.pressed_data_lock.acquire()

            #Set pressed pins to 1.
            for key in self.pressed_data:
                if key in self.opts['pin_assignments']:
                    pin = self.opts['pin_assignments'][key]
                    for run in coil_runs:
                        if run.contains_coil(pin):
                            run.set_pin(pin, 1)
                            break
                else:
                    print("Invalid key " + key + " received, ignoring.")
    
            self.pressed_data_lock.release()
            #print('Starting send data:')
            #Send all coil data to the PLC
            #for run in coil_runs:
            #    print(run.coil_data)
                #self.master.execute(self.opts['modbus_slave_num'], cst.WRITE_MULTIPLE_COILS, run.min_coil, output_value=run.coil_data)
            
            #print('Ending send data')
            #Sleep for a user defined amount of time
            time.sleep(self.opts['modbus_sleep_inteval'])

    def kill():
        self.should_die = True
        
#Represents a "run" of contiguous coils. This is so we can send coil data in
#Batches instead of one at a time.
class CoilRun:
    def __init__(self, initial_coil):
        self.min_coil = initial_coil
        self.max_coil = initial_coil
        self.coil_data = [0]

    def num_coils(self):
        return self.max_coil - self.min_coil + 1
    
    def add_coil(self, pin_number):
        if pin_number == self.max_coil + 1:
            self.max_coil += 1
        elif pin_number == self.min_coil - 1:
            self.min_coil -= 1
        else:
            return False
        self.coil_data.append(0)
        return True
    
    def set_pin(self, pin, val):
        if not self.contains_coil(pin):
            return False
        
        coil_index = pin - self.min_coil
        self.coil_data[coil_index] = val

    def contains_coil(self, pin_number):
            return (pin_number <= self.max_coil and pin_number >= self.min_coil)
    
    def reset_coil_data(self):
        '''
        reset all coils to 0.
        '''
        self.coil_data = [0 for x in range(self.num_coils())]
