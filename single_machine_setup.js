const { spawnSync } = require('child_process');
const prompt = require('prompt');
const fs = require('fs');

const ARM_PORTS_START = 3002;
const MAX_ARMS = 1;
const CAMERA_PORTS_START = ARM_PORTS_START + 2*MAX_ARMS + 1;

//Logger for standard out no time stamp
const log4js = require('log4js');
log4js.configure({
  appenders: { 'out': { type: 'stdout', layout: { type: 'messagePassThrough' } } },
  categories: { default: { appenders: ['out'], level: 'info' } }
});

const logger = log4js.getLogger('out');

class SetupAction {
    constructor(action, message, prompts){
        this.action = action;
        this.message = message;
        this.prompts = prompts === undefined ? false : prompts;
    }

    displayMessage(){
        logger.info(this.message);
    }

    async doAction(state){
        let ret = await this.action(state); 
        
        if(ret !== undefined) return ret;
        
        return state;
    }
}

const setup_actions = [
    new SetupAction(setupDB, 'Setting up database...', true),
    new SetupAction(setupSMTP, 'Setting up SMTP information...', true),
    new SetupAction(setupDomainName, 'Setting up domain name information...', true),
    new SetupAction(setupClientCertificate,'Generating client certificate...'),
    new SetupAction(setupArmsAndCameras,'Setting up arm servers and cameras...'),
    new SetupAction(redirectPorts, 'Redirecting port 80 and 443 to webserver...'),
    new SetupAction(generateServerCerts, 'Generating server certificates...'),
    new SetupAction(finalizeOptions, 'Finalizing options...'),
    new SetupAction(generateRunScript, 'Generating run script...')
];

const prompt_dialogue = 
`The following prompts will ask you configuration questions.
Some prompts will have a default value, denoted by parenthesis after the prompt.
To accept the default value, simply enter nothing.
If you do not understand an option, please reference the ReadMe
on the GitHub page of this project.
`
let state = {
    step: 0
};

function saveState(state){
    try{
        fs.writeFileSync(__dirname + '/setup.state.json', JSON.stringify(state), {flags: 'w'});
    }catch(err){
        logger.info('Couldn\'t write last known good state!');
    }
}

process.on('SIGINT', () => saveState(state));

async function main(){
    //attempt to load state
    try{
        fs.accessSync(__dirname  + '/setup.state.json');
        //File exists, load it
        let schema = {
            use_old: {
                description: 'You were in the middle of setting up when this application last closed.\n' + 
                'Would you like to start from the last checkpoint?',
                type: 'string',
                pattern: /^y$|^yes$|^n$|^no$/i,
                message: 'Must enter yes or no.',
                required: false,
                default: 'yes'
            }
        }
        let res = await prompt_promise(schema);

        let use_old = /^y$|^yes$/.test(res.use_old);
        
        if(use_old){
            state = require('./setup.state');
            logger.info('Starting from last known good state...');
        }else{
            logger.info('Restarting from the beginning.');
            fs.unlinkSync(__dirname + '/setup.state.json');
        }
    }catch(err){

    }

    let first_prompt = true;
    try{
        for(;state.step < setup_actions.length;state.step++){
            let state_copy = deepCopy(state);
            setup_actions[state.step].displayMessage();

            //If the step is the first with prompts, explain them.
            if(setup_actions[state.step].prompts && first_prompt){
                first_prompt = false;
                logger.info(prompt_dialogue);
            }

            state = await setup_actions[state.step].doAction(state_copy); 
        }
    }catch(err){
        //error; save last know good state.
        saveState(state);
        throw err;
    }

    //try to delete state. Could fail, don't really care.
    try{
        fs.unlinkSync(__dirname + '/setup.state.json');
    }catch(err){}
}

let prompt_called = false;
/* Promise wrapper for callback based prompt API */
function prompt_promise(schema){
    if(!prompt_called){
        prompt_called = true;
        prompt.start({noHandleSIGINT: true});
        process.on('SIGINT', () => saveState(state));
        prompt.delimiter = '';
        prompt.message = '';
    }

    return new Promise((resolve, reject)=>{
        try{
            prompt.get({properties: schema}, function(err, result){
                if(err) return reject(err);
                resolve(result);
            });
        }catch(err){
            reject(err);
        }
    });
}

/* Gets an array, containing the identifiers of all network interfaces
   installed and recognized on the machine.
   It does this by scanning the output of the ip link show command.
*/
function getAllNetworkInterfaces(){
    let ip_proc = spawnSync('ip', ['link', 'show']);
    
    if(ip_proc.status != 0){
        throw 'Failed to identify network interfaces!\n' +
        + 'Failed output: \n' +
        sign_client_cert.stdout ? sign_client_cert.stdout.toString('utf8') + '\n' : '' +
        sign_client_cert.stderr ? sign_client_cert.stderr.toString('utf8') + '\n' : '';
    }

    let ip_proc_output = ip_proc.stdout.toString('utf8');
    let interface_regex = /^\d*: (\w*):/gm;
    let interfaces = [];
    let match;
    
    while((match = interface_regex.exec(ip_proc_output)) !== null ){
        interfaces.push(match[1]);
    }

    return interfaces;
}
//Does a deep copy of an object.
//Currently a super slow, naive implementation.
//Doesn't need to be fast, though, so this should be good enough.
function deepCopy(obj){
    return JSON.parse(JSON.stringify(obj));
}

async function setupDB(state){
    state.node_options = require(__dirname + '/node/settings_example.json');

    let schema = {
        hostname: {
            description: 'Server hostname (relative to MySQL server):',
            pattern: /[^\s]*/,
            type: 'string',
            default: 'localhost',
            message: 'Whitespace is not allowed in hostnames.',
            required: false
        },
        mysql_host:{
            description: 'MySQL hostname:',
            pattern: /[^\s]*/,
            type: 'string',
            default: 'localhost',
            message: 'Whitespace is not allowed in hostnames.',
            required: false
        },
        mysql_port:{
            description: 'MySQL port:',
            conform: (val) => Number(val) != NaN && Number(val) > 0 && Number(val) <= 65535,
            message: 'Port must be a number between 0 and 65535',
            type: 'number',
            default: 3306,
            required: false
        },
        admin_user: {
            description: 'MySQL admin username:',
            type: 'string',
            default: 'root',
            required: false
        },
        admin_user_pass: {
            description: 'MySQL admin password:',
            type: 'string',
            message: 'Please enter a password',
            hidden: true,
            replace: '*',
            required: true
        },
        new_user_pass: {
            description: 'New password for RobotRemote MySQL user:',
            type: 'string',
            message: 'Please enter a password',
            hidden: true,
            replace: '*',
            required: true
        }
    };

    let mysql_options = await prompt_promise(schema);
    
    state.node_options.mysql_host = mysql_options.mysql_host;
    state.node_options.mysql_port = mysql_options.mysql_port;
    state.node_options.mysql_pass = mysql_options.new_user_pass;

    let mysql_admin_user = mysql_options.admin_user;
    let mysql_admin_user_pass = mysql_options.admin_user_pass;

    //Execute DB setup
    let db_setup = spawnSync('npm', ['run', 'db_setup', '--', state.node_options.mysql_host + ':' + state.node_options.mysql_port, mysql_options.hostname, 
        mysql_admin_user, mysql_admin_user_pass, state.node_options.mysql_pass], {cwd: __dirname});
    
    if(db_setup.status != 0){
        throw 'DB setup failed.\n' +
        'Failed output: \n' +
        //I strip the first 2 lines here, because they contain sensitive information
        //namely the passwords the user has just entered.
        db_setup.stdout ? db_setup.stdout.toString('utf8').split('\n').slice(3).join('\n') + '\n' : '' +
        db_setup.stderr ? db_setup.stderr.toString('utf8') + '\n' : '';
    }

    return state;
}

async function setupSMTP(state){

    schema = {
        require_auth:{
            description: 'Does your SMTP server require authentication?',
            type: 'string',
            pattern: /^y$|^yes$|^n$|^no$/i,
            message: 'Must enter yes or no.',
            required: false,
            default: 'yes'
        }
    }

    let result = await prompt_promise(schema);

    state.node_options.smtp_auth = /^y$|^yes$/.test(result.require_auth);

    if(state.node_options.smtp_auth){
        //Yes, need authentication
        schema = {
            smtp_username: {
                description: 'Enter your smtp username:',
                type: 'string',
                required: true
            },
            smtp_password: {
                description: 'Enter your smtp password:',
                type: 'string',
                required: true,
                hidden: true,
                replace: '*'
            }
        }

        let credentials = await prompt_promise(schema);
        
        state.node_options.smtp_username = credentials.smtp_username;
        state.node_options.smtp_password = credentials.smtp_password;

    }

    schema = {
        smtp_host: {
            description: 'Enter the hostname of the smtp server:',
            type: 'string',
            required: true
        },
        smtp_port: {
            description: 'Enter the port of the smtp server:',
            type: 'number',
            conform: (val) => Number(val) != NaN && Number(val) > 0 && Number(val) <= 65535,
            message: 'Port must be a number between 0 and 65535',
            default: 465,
            required: false
        },
        smtp_secure: {
            description: 'Does this server use SSL?',
            type: 'string',
            pattern: /^y$|^yes$|^n$|^no$/i,
            message: 'Must enter yes or no.',
            required: false,
            default: 'yes'
        },
        smtp_mailer: {
            description: 'Enter the email address you are sending mail from:',
            type: 'string',
            pattern: /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
            message: 'Please enter a valid email address.',
            required: true
        }
    }

    let smtp_results = await prompt_promise(schema);
    state.node_options.smtp_host = smtp_results.smtp_host;
    state.node_options.smtp_port = smtp_results.smtp_port;
    state.node_options.smtp_secure = /^y$|^yes$/.test(smtp_results.smtp_secure);
    state.node_options.mailer_email = smtp_results.smtp_mailer;

    return state;
}

async function setupDomainName(state){
    //Domain name
    schema = {
        domain: {
            description: 'Enter your primary domain name (where you will host this site):',
            type: 'string',
            default: 'localhost',
            required: false
        }
    }

    let domain_results = await prompt_promise(schema);
    state.node_options.domain_name = 'http://' + domain_results.domain;
    state.node_options.domain_name_secure = 'https://' + domain_results.domain;

    return state;
}

async function setupClientCertificate(state){
    try{
        fs.accessSync(__dirname + '/helperscripts/cacert/cacert.pem');
        fs.accessSync(__dirname + '/helperscripts/cacert/cakey.pem');
    }catch(err){
        logger.info('Either the CA file or key file does not exist, attempting to create...');

        try{
            fs.mkdirSync(__dirname + '/helperscripts/cacert');
        }catch(err){

        }
        //open and close file to create it
        fs.closeSync(fs.openSync(__dirname + '/helperscripts/cacert/index.txt', 'w'));
        fs.closeSync(fs.openSync(__dirname + '/helperscripts/cacert/serial.txt', 'w'));
        fs.truncateSync(__dirname + '/helperscripts/cacert/serial.txt');
        fs.appendFileSync(__dirname + '/helperscripts/cacert/serial.txt', '01');

        let create_ca = spawnSync('openssl', ['req', '-x509', '-config', 'openssl-ca.cnf', '-newkey', 'rsa:4096', '-sha256', '-nodes', 
            '-subj', '/C=US/ST=Michigan/L=Houghton/O=Michigan Technological University/OU=RobotRemote Team/CN=RobotRemote CA', 
            '-keyout', 'cacert/cakey.pem', '-out', 'cacert/cacert.pem', '-outform', 'PEM'], {cwd: __dirname + '/helperscripts'});
        
        if(create_ca.status != 0){
            throw 'Failed to create the CA certificate!\n'
            + 'Failed output: ' +
            create_ca.stdout ? create_ca.stdout.toString('utf8') + '\n' : '' +
            create_ca.stderr ? create_ca.stderr.toString('utf8') + '\n' : '';
        }       
    }

    try{
        fs.mkdirSync(__dirname + '/helperscripts/client-cert');
    }catch(err){

    }
    
    let create_client_key = spawnSync('openssl', ['genrsa', '-out', 'client-cert/key.pem', '2048'], {cwd: __dirname + '/helperscripts'});
    if(create_client_key.status != 0){
        throw 'Failed to create the client key!\n' +
        'Failed output: \n' +
        create_client_key.stdout ? create_client_key.stdout.toString('utf8') + '\n' : '' +
        create_client_key.stderr ? create_client_key.stderr.toString('utf8') + '\n' : '';
    }

    let create_client_csr = spawnSync('openssl', ['req', '-config', 'openssl-client.cnf', '-new', '-sha256', '-key', 'client-cert/key.pem', 
        '-subj', '/C=US/ST=Michigan/L=Houghton/O=Michigan Technological University/OU=RobotRemote Team/CN=RobotRemote Webserver Client Certificate',
        '-out', 'client-cert/cert.csr'], {cwd: __dirname + '/helperscripts'});
    if(create_client_csr.status != 0){
        throw 'Failed to create the client certificate signing request!\n' +
        'Failed output: \n' +
        create_client_csr.stdout ? create_client_csr.stdout.toString('utf8') + '\n' : '' +
        create_client_csr.stderr ? create_client_csr.stderr.toString('utf8') + '\n' : '';
    }

    let sign_client_cert = spawnSync('openssl',['ca', '-batch', '-config', 'openssl-ca.cnf', '-policy', 'signing_policy', '-extensions', 'signing_req', 
        '-out', 'client-cert/cert.pem', '-infiles','client-cert/cert.csr'], {cwd: __dirname + '/helperscripts'});
    if(sign_client_cert.status != 0){
        throw 'Failed to sign the client certificate!\n' +
        + 'Failed output: \n' +
        sign_client_cert.stdout ? sign_client_cert.stdout.toString('utf8') + '\n' : '' +
        sign_client_cert.stderr ? sign_client_cert.stderr.toString('utf8') + '\n' : '';
    }
    //make cert directorysin
    try{
        fs.mkdirSync(__dirname + '/node/cert');
    }catch(err){
        
    }

    try{
        fs.mkdirSync(__dirname + '/arm_server/cert');
    }catch(err){
        
    }

    try{
        fs.mkdirSync(__dirname + '/webcam_stuff/cert');
    }catch(err){
        
    }

    //Copy cert stuff to where it needs to be
    fs.copyFileSync(__dirname + '/helperscripts/client-cert/cert.pem', __dirname + '/node/cert/client_cert.pem');
    fs.copyFileSync(__dirname + '/helperscripts/client-cert/key.pem', __dirname + '/node/cert/client_key.pem');
    fs.copyFileSync(__dirname + '/helperscripts/cacert/cacert.pem', __dirname + '/node/cert/cacert.pem');
    fs.copyFileSync(__dirname + '/helperscripts/cacert/cacert.pem', __dirname + '/arm_server/cert/cacert.pem');
    fs.copyFileSync(__dirname + '/helperscripts/cacert/cacert.pem', __dirname + '/webcam_stuff/cert/cacert.pem');

    return state;
}

async function setupArmsAndCameras(state){
    schema = {
        arms: {
            description: 'How many arms are you using?',
            conform: (val) => Number(val) != NaN && val > 0 && val <= MAX_ARMS,
            message: `Must be between 1 and ${MAX_ARMS} arms.`,
            default: 1,
            required: false
        },
        cameras: {
            description: 'How many cameras are you using per arm?',
            conform: (val) => Number(val) != NaN && val > 0 && val <= 3,
            message: 'Must be between 1 and 3 cameras.',
            default: 2,
            required: false
        }
    }

    let num_results = await prompt_promise(schema);
    state.num_cameras = num_results.cameras;
    state.num_arms = num_results.arms;

    let base_pin_assignments = require('./python/settings_example.json').pin_assignments;
    //generate all python settings
    state.node_options.actuator_servers = [];
    for(let i = 0; i < state.num_arms; i++){
       let opts = {};
       opts.verbose = true;
       opts.socket_port = ARM_PORTS_START + 2*i;
       opts.websocket_port = ARM_PORTS_START + 2*i + 1;
       opts.websocket_accepted_origins = [
            state.node_options.domain_name_secure
       ];
       opts.disable_modbus = false;
       opts.modbus_host = '127.0.0.1';
       opts.modbus_port = 502;
       opts.modbus_slave_num = i+1;
       opts.modbus_timeout = 1.0;
       opts.modbus_sleep_interval = 0.125;
       opts.cert_file = "cert/cert.pem";
       opts.key_file = "cert/key.pem";
       opts.client_ca_file = "cert/cacert.pem";
       opts.debug = false;
       opts.pin_assignments = base_pin_assignments;

       let webserver_cam_opts = [];
       //camera settings
        for(let j = 0; j < state.num_cameras; j++){
            let cam_opts = {};
            cam_opts.websock_port = CAMERA_PORTS_START + i*state.num_cameras + j*3;
            cam_opts.stream_port = CAMERA_PORTS_START + i*state.num_cameras + j*3 + 1;
            cam_opts.webserver_listen_port = CAMERA_PORTS_START + i*state.num_cameras + j*3 + 2;
            cam_opts.ssl = true;
            cam_opts.cert = "cert/cert.pem";
            cam_opts.key = "cert/key.pem";
            cam_opts.client_ca = "cert/cacert.pem";
            
            webserver_cam_opts.push({ip: '127.0.0.1', websock_port: cam_opts.websock_port, secure: true, comm_port: cam_opts.webserver_listen_port});

            fs.writeFileSync(__dirname + `/webcam_stuff/webcam-${i}-${j}.json`, JSON.stringify(cam_opts, undefined, 4), {flags: 'w'});
        }

        state.node_options.actuator_servers.push({ip: '127.0.0.1', socket_port: opts.socket_port, websock_port: opts.websocket_port, web_cams: webserver_cam_opts});
        
        fs.writeFileSync(__dirname + `/arm_server/arm-${i}.json`, JSON.stringify(opts, undefined, 4), {flags: 'w'});
    }

    return state;
}

//TODO when generating the run script, we need to 
async function generateRunScript(state){
    let script = 
`const { spawn } = require('child_process');
const fs = require('fs');

//Start up the webserver.
let webserver_proc = spawn('npm', ['run', 'start_webserver'], 
    {stdio: [
        0, 
        process.stdout, 
        process.stderr]
    }
);
//Start up arm servers
${(()=>{
    let exec_arms = '';
    for(let i = 0; i<state.num_arms;i++){
        exec_arms += `let arm_${i}_proc = spawn('npm', ['run', 'start_arm', '--', 'arm-${i}.json'],
    {stdio: [
        0, 
        process.stdout, 
        process.stderr]
    }       
);\n`;
    }
    return exec_arms;
})()}
//start up camera servers
${(()=>{
    let exec_cameras = '';
    for(let i = 0; i<state.num_arms; i++){
        for(let j = 0; j<state.num_cameras; j++){
            exec_cameras += `let camera_${i}_${j}_proc = spawn('npm', ['run', 'start_camera', '--', 'webcam-${i}-${j}.json'],
    {stdio: [
        0, 
        process.stdout, 
        process.stderr]
    }
);\n`
        }
    }
    return exec_cameras;
})()}
//Boot up ffmpeg streams
${(()=>{
    let exec_ffmpeg = '';
    for(let i = 0; i<state.num_arms; i++){
        for(let j = 0; j<state.num_cameras; j++){
            //TODO fix this so that this could work on windows too (change v4l2 to DirectShow or whatever)
            //TODO add configuration for resolution of camera, maybe
            exec_ffmpeg += `let ffmpeg_${i}_${j}_proc = spawn('ffmpeg', ['-nostdin', '-loglevel', 'fatal', '-nostats', '-f', 'v4l2', 
    '-framerate', '24', '-video_size', '640x480', '-i', '/dev/video${i*state.num_cameras + j}', '-f', 'mpegts',
    '-codec:v', 'mpeg1video', '-s', '640x480', '-b:v', '1000k', '-bf', '0', 'http://localhost:${CAMERA_PORTS_START + i*state.num_cameras + j*3 + 1}'],
        {stdio:[
            0, 
            process.stdout, 
            process.stderr]
        }   
);\n`;
        }
    }
    return exec_ffmpeg;
})()}

//Terminate all when this process gets SIGTERM
function terminate_all(){
    logger.info('Killing all processes...');
    webserver_proc.kill('SIGTERM');
${(()=>{
    let kill_arms = '';
    for(let i = 0; i < state.num_arms; i++){
        kill_arms += `    arm_${i}_proc.kill('SIGTERM');\n`;
    }
    return kill_arms;
})()}
${(()=>{
    let kill_cams = '';
    for(let i = 0; i < state.num_arms; i++){
        for(let j = 0; j < state.num_cameras; j++){
            kill_cams += `    camera_${i}_${j}_proc.kill('SIGTERM');\n`;
        }
    }
    return kill_cams;
})()}
    //ffmpeg should die when the cameras die, but just in case...
${(()=>{
    let ffmpeg_kill = '';
    for(let i = 0; i < state.num_arms; i++){
        for(let j = 0; j < state.num_cameras; j++){
            ffmpeg_kill += `    ffmpeg_${i}_${j}_proc.kill('SIGTERM');\n`;
        }
    }
    return ffmpeg_kill;
})()}
    process.exit(0);
}

process.on('SIGTERM', terminate_all);
process.on('SIGINT', terminate_all);
process.on('SIGHUP', terminate_all);

process.stdin.resume();

logger.info('All processes started, use CTRL+C to kill.');
`;
        
    fs.writeFileSync(__dirname + '/run.js', script, {flags: 'w'});

    return state;
}

async function redirectPorts(state){
    //TODO make this skippable (doesn't work on WSL)    
    let redirect_script = '';
    let interfaces = getAllNetworkInterfaces();

    for(let i = 0; i < interfaces.length; i++){
        redirect_script += `\tiptables -t nat -A PREROUTING -i ${interfaces[i]} -p tcp --dport 80 -j REDIRECT --to-port 3000 &&\n`;
        redirect_script += `\tiptables -t nat -A PREROUTING -i ${interfaces[i]} -p tcp --dport 443 -j REDIRECT --to-port 3001 &&\n`;
    }

    redirect_script = redirect_script.slice(0,-4) + ';';

    //Attempt running the redirections (probably fails if not root or using sudo)
    let redirect_proc = spawnSync(redirect_script, [], {shell: true});

    if(redirect_proc.status != 0){
        /*
        throw 'Failed to redirect ports! Make sure you are running using sudo/as root\n' +
        'Failed output: \n' +
        redirect_proc.stdout.toString('utf8') + '\n' +
        redirect_proc.stderr.toString('utf8');
        */
       logger.info('Failed to redirect port 80 to 3000, and failed to redirect port 443 to 3001, please do this manually.');
       return state;
    }

    logger.info('Attempting to add to rc.local...');
    //Create file if it doesn't exist
    fs.closeSync(fs.openSync('/etc/rc.local', 'a'));
    //Check if the generated string already exists
    //To do this, we add some comments.
    //#BEGIN PORT REDIRECT
    //and
    //#END PORT REDIRECT
    //If these comments exist, we assume that the correct string is there.
    //Also, we look for exit 0, and attempt to insert above that, if it exists.
    port_redirect_regex = /#BEGIN PORT REDIRECT\n[^]*\n#END PORT REDIRECT\n/
    redirect_script = '#BEGIN PORT REDIRECT\n' + redirect_script + '\n#END PORT REDIRECT\n'

    rc_local = fs.readFileSync('/etc/rc.local', {encoding: 'utf8'});

    if(!port_redirect_regex.test(rc_local)){
        //We need to insert our script for startup...
        let insert_point = 0;
        let exit_start = rc_local.indexOf('exit 0');
        let new_rc_local;

        if(exit_start == -1){
            insert_point = 0;
            redirect_script += 'exit 0';
        }else{
            insert_point = exit_start;
        }
        
        //Might be a new file, needs #!/bin/sh
        if(!rc_local.startsWith('#!')){
            rc_local = '#/bin/sh\n' + rc_local;
            insert_point += '#/bin/sh\n'.length;
        }

        new_rc_local = rc_local.split(0, insert_point) + '\n' + redirect_script + rc_local.split(insert_point);

        fs.writeFileSync('/etc/rc.local', new_rc_local, {flags: 'w'});
    }

    //activate rc.local if it's not already active
    let cur_mode = fs.statSync('/etc/rc.local').mode;
    cur_mode += 0o100; //Add execute bit for root.
    fs.chmodSync('/etc/rc.local', cur_mode);

    return state;
}

async function generateServerCerts(state){
    return state;
}

async function finalizeOptions(state){
    fs.writeFileSync(__dirname + '/node/settings.json', JSON.stringify(state.node_options, undefined, 4), {flags:'w'});
    return state;
}

process.on('uncaughtException', function (exception) {
    logger.info(exception);
});

process.on('unhandledRejection', (reason, p) => {
    logger.info("Unhandled Rejection at: Promise ", p, " reason: ", reason);
});

main().then(()=>{
    logger.info('Succesfully set up!');
}).catch((err)=>{
    logger.info('An error occured!');
    logger.info(err);
});
