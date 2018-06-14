const mysql = require('mysql2/promise');
const minutes = 30;

let pool = null;
let db_interval = 0;

module.exports = {
    init_mysql: function(conn_pool){
        pool = conn_pool;
        //Clean the DB every X minutes
        db_interval = setInterval(clean_db, minutes*60*1000);
    },
    /* if num_requests <= 0, we get all requests. */
    get_login_requests: async function(start_at, num_requests){
        let json = [];
        connection = await pool.getConnection();   
        try{
            if(num_requests <= 0 ){
                var [res, field] = await connection.query('SELECT loginrequests.id, users.email, loginrequests.comment, loginrequests.date_requested FROM users INNER JOIN loginrequests ON users.loginreq_id = loginrequests.id WHERE email_validated=1', []);    
            }else{
                var [res, field] = await connection.query('SELECT loginrequests.id, users.email, loginrequests.comment, loginrequests.date_requested FROM users INNER JOIN loginrequests ON users.loginreq_id = loginrequests.id WHERE email_validated=1 LIMIT ? OFFSET ?', [num_requests, start_at]);
            }
        }finally{
            connection.release();
        }
        for(let i = 0; i<res.length; i++){
            json.push({
                id: res[i].id,
                email: res[i].email,
                reason: res[i].comment,
                date_requested: res[i].date_requested.toISOString()
            });
        }

        return json;
    
    },
    get_current_users: async function(start_at, num_requests){
        let json = [];
        connection = await pool.getConnection();   
        try{
            if(num_requests <= 0 ){
                var [res, field] = await connection.query('SELECT users.email FROM users WHERE approved=1', []);    
            }else{
                var [res, field] = await connection.query('SELECT users.email FROM users WHERE approved=1 LIMIT ? OFFSET ?', [num_requests, start_at]);
            }
        }finally{
            connection.release();
        }
        for(let i = 0; i<res.length; i++){
            json.push({
                email: res[i].email
            });
        }

        return json;
    
    },
    /*Gets info about user with given id. Will use given connection if provided, otherwise uses an independant conneciton */
    get_user_by_id: async function(id, connection){
        if(connection){
            var [res, fields] = await connection.query("SELECT * FROM users WHERE id=?", [id]);

        }else{
            var [res, fields] = await pool.query("SELECT * FROM users WHERE id=?", [id]);
        }

        if(res.length < 1){
            throw {
                reason: "Couldn't find user in the database!",
                client_reason: ""
            };
        }
        return {id: res[0].id, email: res[0].email};
    },
    /*Timeframe is between beginDate and endDate.*/
    user_get_timeslot_requests: async function(beginDate, endDate, user_id){
    
        let connection = await pool.getConnection();   
        try{
            var [res, fields] = await connection.query('SELECT id, start_time, duration, approved, user_id FROM timeslots WHERE start_time > ? AND start_time < ?', [beginDate, endDate]);
        }finally{
            connection.release();
        }
        
        let mine = [];
        let others = [];
        
        for(let i = 0; i<res.length; i++){

            if(res[i].user_id == user_id){
                mine.push({
                    id: res[i].id,
                    starttime: res[i].start_time.toISOString(),
                    duration: res[i].duration,
                    email: res[i].email,
                    accepted: res[i].approved
                });
            }else{
                others.push({
                    starttime: res[i].start_time.toISOString(),
                    duration: res[i].duration,
                    accepted: res[i].approved
                });
            }
            
        }
        return {mine: mine, others: others};
    },

    admin_get_timeslot_requests: async function(beginDate, endDate){
        let connection = await pool.getConnection();
        try{
            var [res, fields] = await connection.query('SELECT users.email, timeslots.id, timeslots.start_time, timeslots.duration, timeslots.approved'+
            ' FROM timeslots INNER JOIN users ON timeslots.user_id=users.id'+
            ' WHERE start_time >= ? AND start_time < ?', 
            [beginDate, endDate]);
        }finally{
            connection.release();
        }
        
        let unapproved = [];
        let approved = [];

        for(let i = 0; i<res.length; i++){
            if(res[i].approved){
                approved.push({
                    email: res[i].email,
                    id: res[i].id,
                    starttime: res[i].start_time.toISOString(),
                    duration: res[i].duration,
                });
            }else{
                unapproved.push({
                    email: res[i].email,
                    id: res[i].id,
                    starttime: res[i].start_time.toISOString(),
                    duration: res[i].duration,
                });
            }                        
        }

        return {approved: approved, unapproved: unapproved};
    },
    //date is a date object that is the start time, duration is duration in seconds.
    does_request_overlap_own: async function(date, duration, user_id, conn){
        /*
            check if begin time or end time is between any of the users own..
        */
        let connection = null;
        if(conn !== undefined){
            connection = conn;
        }else{
            connection = await pool.getConnection();
        }
        
        try{
            let start_date = date;
            let end_date = new Date(date.getTime() + duration*1000);
        
            var [res, fields] = await connection.query("SELECT count(*) FROM timeslots WHERE user_id=? AND"+
                " ((start_time <= ? AND DATE_ADD(start_time, INTERVAL duration SECOND) >= ?)"+
                " OR (start_time <= ? AND DATE_ADD(start_time, INTERVAL duration SECOND) >= ?))",
            [user_id, start_date, start_date, end_date, end_date]);
        }finally{
            connection.release();
        }

        return res[0]['count(*)'] != 0;
    },
    //date is a date object that is the start time, duration is duration in seconds.
    does_request_overlap_accepted: async function(date, duration, conn){
        /*
            check if begin time or end time is between any approved others. 
        */
        if(conn !== undefined){
            connection = conn;
        }else{
            connection = await pool.getConnection();
        }
        try{
            let start_date = date;
            let end_date = new Date(date.getTime() + duration*1000);
            
            var [res, fields] = await connection.query("SELECT count(*) FROM timeslots WHERE approved=1 AND"+
                " ((start_time <= ? AND DATE_ADD(start_time, INTERVAL duration SECOND) >= ?)"+
                " OR (start_time <= ? AND DATE_ADD(start_time, INTERVAL duration SECOND) >= ?))",
            [start_date, start_date, end_date, end_date]);
        }finally{
            connection.release();
        }

        return res[0]['count(*)'] != 0;
    },
    //date is a date object that is the start time, duration is duration in seconds.
    add_request: async function(date, duration, user_id){
        let connection = await pool.getConnection();   
                
        let overlap_accepted = null;
        let overlap_own = null;
        //This needs to be transactional; 2 connections that read then insert could conflict (first one reads, second reads, both attempt to insert).
        try{
            await connection.beginTransaction();

            overlap_accepted = await this.does_request_overlap_accepted(date, duration, connection);
            
            if(overlap_accepted){
                throw {
                    reason: 'Timeslot already taken!',
                    client_reason: 'Requested timeslot overlaps one that\'s already taken!',
                };
            }

            overlap_own = await this.does_request_overlap_own(date, duration, user_id, connection);
            
            if(overlap_own){
                throw {
                    reason: 'Timeslot already taken!',
                    client_reason: 'Requested timeslot overlaps one that\'s already taken!',
                };
            }

            await connection.query("INSERT INTO timeslots (user_id, start_time, duration) VALUES (?, ?, ?)", [user_id, date, duration]);
            await connection.commit();
        }catch(e){
            //Rollback, let error bubble up.
            await connection.rollback();
            throw e;
        }finally{
            connection.release();
        }
        return true;        
    },
    delete_request: async function(req_id, user_id){   
                
        let [res, fields] = await pool.query("DELETE FROM timeslots WHERE user_id=? AND id=?", [user_id, req_id]);
    
        if(res.affectedRows <= 0){
            throw {
                reason: 'Could not delete! Already deleted OR attempt to delete when it was not their request.',
                client_reason: 'Timeslot already deleted!'
            };
        }
        return;
    },

    /*
    Deletes timeslot request with the given ID from the database. 
    On success, returns the ID of the user whos timeslot was just deleted.
    */
    delete_timeslotrequest_admin: async function(id){
        
        let connection = await pool.getConnection();
        
        try{
            let [res, fields] = await connection.query("SELECT user_id FROM timeslots WHERE id=?", [id]);
            

            if(res.length < 1){
                throw {
                    reason: 'Bad ID for timeslot.',
                    client_reason: 'Couldn\'t find timeslot in database!',
                };
            }

            var user_id = res[0].user_id;

            await connection.query("DELETE FROM timeslots WHERE id=?", [id]);

        }finally{
            connection.release();
        }

        return user_id;
        
    },

    /*Same general format as above. returns ID of the user 
    who's timeslot was accepted. 
    */
    accept_timeslot_request: async function(id){

        let connection = await pool.getConnection();
        await connection.beginTransaction();

        try{
            let [res0, fields0] = await connection.query("SELECT user_id, start_time, duration FROM timeslots WHERE id=?", [id]);
            
            if(res0.length < 1){
                throw {
                    reason: 'Bad ID for timeslot.',
                    client_reason: 'Couldn\'t find timeslot in database!',
                };
            }

            var user_id = res0[0].user_id;
            let start_date = res0[0].start_time;
            let end_date = new Date(start_date.getTime() + res0[0].duration * 1000);

            //Delete overlapping timeslots
            await connection.query("DELETE FROM timeslots WHERE id!=? AND"+
            " ((start_time <= ? AND DATE_ADD(start_time, INTERVAL duration SECOND) >= ?)"+
            " OR (start_time <= ? AND DATE_ADD(start_time, INTERVAL duration SECOND) >= ?))",
            [id, start_date, start_date, end_date, end_date]);

            //Set approved for this one.
            await connection.query("UPDATE timeslots SET approved=1 WHERE id=?", [id]);

            await connection.commit();
        }catch(e){
            await connection.rollback();
            throw e;
        }finally{
            connection.release();
        }

        return user_id;
    },
    /*
      Deletes the user and request associated with the passed in ID.
      Returns the users email and stuff.
    */
    delete_user_by_request: async function(req_id){
        let connection = await pool.getConnection();
        try{
            //This delete cascades;
            //This means that any user that references this login request is removed.
            let [res, fields] = await connection.query("SELECT id FROM users WHERE loginreq_id=?", [req_id]);
            
            if(res.length != 1){
                throw {
                    reason: "Login request doesn't exist!",
                    client_reason:"Invalid ID."
                };
            }
            
            let user_id = res[0].id;
            user_details = await this.get_user_by_id(user_id, connection);

            await connection.query("DELETE FROM loginrequests WHERE id=?", [req_id]);
        }finally{
            connection.release();
        }
        return user_details;
    },
        /*
      Deletes the user associated with the passed in ID.
      Returns the users email and stuff.
    */
    delete_user_by_ID: async function(req_id){
        let connection = await pool.getConnection();
        try{
            //This delete cascades;
            //This means that any user that references this login request is removed.
            let [res, fields] = await connection.query("SELECT id FROM users WHERE loginreq_id=?", [req_id]);
            
            if(res.length != 1){
                throw {
                    reason: "Login request doesn't exist!",
                    client_reason:"Invalid ID."
                };
            }
            
            let user_id = res[0].id;
            user_details = await this.get_user_by_id(user_id, connection);

            await connection.query("DELETE FROM users WHERE id=?", [req_id]);
        }finally{
            connection.release();
        }
        return user_details;
    },
    /*
      Marks the user as approved, and deletes the request.
      returns ID of the approved user.
    */
    accept_user: async function (req_id){
        let connection = await pool.getConnection();
        try{
            let [res, fields] = await connection.query("SELECT id FROM users WHERE loginreq_id=?", [req_id]);
            
            if(res.length != 1){
                throw {
                    reason: "Login request doesn't exist!",
                    client_reason:"Invalid ID."
                };
            }
            
            var user_id = res[0].id;
            
            await connection.query("UPDATE users SET approved=1, loginreq_id=NULL WHERE id=?", [user_id]);
            
            await connection.query("DELETE FROM loginrequests WHERE id=?", req_id);

        }finally{
            connection.release();
        }

        return user_id;
    }
};

async function clean_db(){
    let connection = await pool.getConnection();
    try{
        await connection.query("DELETE FROM timeslots WHERE DATE_ADD(start_time, INTERVAL duration SECOND) <= ?", [new Date(Date.now())]);
        //Deletes logins and requests from over 2 weeks ago, if they have not been approved yet.
        //TODO send out an email to them if this happens?
        await connection.query("DELETE FROM loginrequests WHERE date_requested < ?", [new Date(Date.now() - 14*24*60*60*1000)]);
    }finally{
        connection.release();
    }

    return;
}